<script setup lang="ts">
import type Graph from "graphology";
import type { ForceAtlas2LayoutParameters } from "graphology-layout-forceatlas2";
import type { NodeLabelDrawingFunction } from "sigma/rendering";
import type Sigma from "sigma";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildSigmaGraph, type SigmaEdgeAttributes, type SigmaNodeAttributes } from "../../lib/sigma-graph";
import type { ForceLayoutOptions, GraphEdgeRow, GraphNode } from "../../types/graph";
import type { ThemeMode } from "../../lib/theme";

type SigmaCtor = typeof import("sigma")["default"];
type ForceAtlas2Runtime = typeof import("graphology-layout-forceatlas2")["default"];
type ForceAtlas2WorkerCtor = typeof import("graphology-layout-forceatlas2/worker")["default"];

interface LayoutSupervisorLike {
  isRunning(): boolean;
  start(): void;
  stop(): void;
  kill(): void;
}

const LIGHT_LABEL_BG = "rgba(255, 255, 255, 0.74)";
const LIGHT_LABEL_BORDER = "rgba(100, 116, 139, 0.45)";
const LIGHT_LABEL_TEXT = "#1F2937";
const DARK_LABEL_BG = "rgba(30, 37, 48, 0.88)";
const DARK_LABEL_BORDER = "rgba(148, 163, 184, 0.35)";
const DARK_LABEL_TEXT = "#e2e8f0";

let labelBgColor = LIGHT_LABEL_BG;
let labelBorderColor = LIGHT_LABEL_BORDER;
let labelTextColor = LIGHT_LABEL_TEXT;

function syncLabelColors(): void {
  const theme = (document.documentElement.dataset.theme ?? "light") as ThemeMode;
  const isDark = theme === "dark";
  labelBgColor = isDark ? DARK_LABEL_BG : LIGHT_LABEL_BG;
  labelBorderColor = isDark ? DARK_LABEL_BORDER : LIGHT_LABEL_BORDER;
  labelTextColor = isDark ? DARK_LABEL_TEXT : LIGHT_LABEL_TEXT;
  renderer?.refresh();
}

const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 4;
const LABEL_BORDER_RADIUS = 5;
const LABEL_POINTER_SIZE = 6;
const LABEL_NODE_GAP = 4;

interface EdgeTooltipState {
  visible: boolean;
  x: number;
  y: number;
  kind: GraphEdgeRow["kind"] | null;
  txHash: string | null;
  weight: number | null;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const clampedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.lineTo(x + width - clampedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  context.lineTo(x + width, y + height - clampedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
  context.lineTo(x + clampedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  context.lineTo(x, y + clampedRadius);
  context.quadraticCurveTo(x, y, x + clampedRadius, y);
  context.closePath();
}

const drawNodeLabelWithBackground: NodeLabelDrawingFunction<SigmaNodeAttributes, SigmaEdgeAttributes> = (
  context,
  data,
  settings,
) => {
  const label = data.label;
  if (!label) {
    return;
  }

  const fontSize = settings.labelSize;
  context.save();
  context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;

  const textWidth = context.measureText(label).width;
  const boxWidth = textWidth + LABEL_PADDING_X * 2;
  const boxHeight = fontSize + LABEL_PADDING_Y * 2;
  const pointerMidY = data.y;
  const pointerTipX = data.x + Math.max(1, data.size * 0.65);
  const boxX = data.x + data.size + LABEL_NODE_GAP + LABEL_POINTER_SIZE;
  const boxY = pointerMidY - boxHeight / 2;

  drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, LABEL_BORDER_RADIUS);
  context.fillStyle = labelBgColor;
  context.fill();
  context.strokeStyle = labelBorderColor;
  context.lineWidth = 1;
  context.stroke();

  context.beginPath();
  context.moveTo(boxX, pointerMidY - LABEL_POINTER_SIZE);
  context.lineTo(pointerTipX, pointerMidY);
  context.lineTo(boxX, pointerMidY + LABEL_POINTER_SIZE);
  context.closePath();
  context.fillStyle = labelBgColor;
  context.fill();
  context.strokeStyle = labelBorderColor;
  context.stroke();

  context.fillStyle = labelTextColor;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, boxX + LABEL_PADDING_X, boxY + boxHeight / 2);
  context.restore();
};

const props = defineProps<{
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdgeRow>;
  showLabels: boolean;
  layoutOptions: ForceLayoutOptions;
  layoutRunId: number;
}>();

const emit = defineEmits<{
  (event: "node-click", nodeId: string): void;
}>();

const LAYOUT_RUNTIME_MS = 900;
const MIN_LAYOUT_NODE_COUNT = 2;

const containerRef = ref<HTMLDivElement | null>(null);
const edgeTooltip = ref<EdgeTooltipState>({
  visible: false,
  x: 0,
  y: 0,
  kind: null,
  txHash: null,
  weight: null,
});

let renderer: Sigma<SigmaNodeAttributes, SigmaEdgeAttributes> | null = null;
let layoutSupervisor: LayoutSupervisorLike | null = null;
let layoutStopTimer: ReturnType<typeof setTimeout> | null = null;
let sigmaCtor: SigmaCtor | null = null;
let forceAtlas2Runtime: ForceAtlas2Runtime | null = null;
let layoutSupervisorCtor: ForceAtlas2WorkerCtor | null = null;
let runtimeLoadPromise: Promise<void> | null = null;
let isDisposed = false;
let rebuildSequence = 0;
let draggedNodeId: string | null = null;
let panningBeforeDrag = true;
let themeObserver: MutationObserver | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hideEdgeTooltip(): void {
  edgeTooltip.value = {
    visible: false,
    x: 0,
    y: 0,
    kind: null,
    txHash: null,
    weight: null,
  };
}

function toEdgeKindLabel(kind: GraphEdgeRow["kind"] | null): string {
  if (kind === "agent-review") {
    return "Agent Review";
  }

  if (kind === "registrant") {
    return "Registrant";
  }

  if (kind === "response") {
    return "Response";
  }

  if (kind === "review") {
    return "Review";
  }

  return "Edge";
}

function formatTooltipTxHash(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function normalizeLayoutOptions(options: ForceLayoutOptions): ForceLayoutOptions {
  return {
    gravity: Number.isFinite(options.gravity) ? clamp(options.gravity, 0, 10) : 1,
    scalingRatio: Number.isFinite(options.scalingRatio) ? clamp(options.scalingRatio, 0.1, 50) : 1.2,
    slowDown: Number.isFinite(options.slowDown) ? clamp(options.slowDown, 0.1, 50) : 2,
    barnesHutOptimize: options.barnesHutOptimize !== false,
    barnesHutTheta: Number.isFinite(options.barnesHutTheta) ? clamp(options.barnesHutTheta, 0.1, 2) : 0.7,
    useEdgeWeights: options.useEdgeWeights !== false,
    edgeWeightInfluence: Number.isFinite(options.edgeWeightInfluence) ? clamp(options.edgeWeightInfluence, 0, 4) : 1,
    autoRescale: options.autoRescale !== false,
    autoCenter: options.autoCenter !== false,
    runtimeMs: Number.isFinite(options.runtimeMs) ? clamp(Math.round(options.runtimeMs), 100, 5_000) : LAYOUT_RUNTIME_MS,
  };
}

async function ensureRuntimeDeps(): Promise<void> {
  if (sigmaCtor && forceAtlas2Runtime && layoutSupervisorCtor) {
    return;
  }

  if (!runtimeLoadPromise) {
    runtimeLoadPromise = Promise.all([
      import("sigma"),
      import("graphology-layout-forceatlas2"),
      import("graphology-layout-forceatlas2/worker"),
    ])
      .then(([sigmaModule, forceAtlasModule, workerModule]) => {
        sigmaCtor = sigmaModule.default;
        forceAtlas2Runtime = forceAtlasModule.default;
        layoutSupervisorCtor = workerModule.default;
      })
      .catch((error: unknown) => {
        runtimeLoadPromise = null;
        throw error;
      });
  }

  await runtimeLoadPromise;
}

function clearLayoutStopTimer(): void {
  if (!layoutStopTimer) {
    return;
  }

  clearTimeout(layoutStopTimer);
  layoutStopTimer = null;
}

function stopAndDisposeLayout(): void {
  clearLayoutStopTimer();

  if (!layoutSupervisor) {
    return;
  }

  if (layoutSupervisor.isRunning()) {
    layoutSupervisor.stop();
  }

  layoutSupervisor.kill();
  layoutSupervisor = null;
}

function destroyRenderer(): void {
  draggedNodeId = null;
  hideEdgeTooltip();
  stopAndDisposeLayout();

  if (!renderer) {
    return;
  }

  renderer.kill();
  renderer = null;
}

function applyRendererSettings(): void {
  if (!renderer) {
    return;
  }

  const options = normalizeLayoutOptions(props.layoutOptions);
  renderer.setSetting("nodeReducer", null);
  renderer.setSetting("renderLabels", props.showLabels);
  renderer.setSetting("labelRenderedSizeThreshold", props.showLabels ? 0 : 10);
  renderer.setSetting("autoRescale", options.autoRescale);
  renderer.setSetting("autoCenter", options.autoCenter);
}

function startBoundedLayout(graph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>): void {
  stopAndDisposeLayout();

  if (graph.order < MIN_LAYOUT_NODE_COUNT) {
    return;
  }

  if (!forceAtlas2Runtime || !layoutSupervisorCtor) {
    return;
  }

  const options = normalizeLayoutOptions(props.layoutOptions);
  const inferred = forceAtlas2Runtime.inferSettings(graph);
  const layoutParams: ForceAtlas2LayoutParameters<SigmaNodeAttributes, SigmaEdgeAttributes> = {
    settings: {
      ...inferred,
      gravity: options.gravity,
      scalingRatio: options.scalingRatio,
      slowDown: options.slowDown,
      barnesHutOptimize: options.barnesHutOptimize,
      barnesHutTheta: options.barnesHutTheta,
      edgeWeightInfluence: options.edgeWeightInfluence,
    },
    getEdgeWeight: options.useEdgeWeights ? "weight" : null,
  };

  layoutSupervisor = new layoutSupervisorCtor(graph, layoutParams);
  layoutSupervisor.start();

  layoutStopTimer = setTimeout(() => {
    if (!layoutSupervisor) {
      return;
    }

    if (layoutSupervisor.isRunning()) {
      layoutSupervisor.stop();
    }

    layoutSupervisor.kill();
    layoutSupervisor = null;
    renderer?.refresh();
  }, options.runtimeMs);
}

function stopDragging(): void {
  if (!renderer || !draggedNodeId) {
    return;
  }

  draggedNodeId = null;
  renderer.setSetting("enableCameraPanning", panningBeforeDrag);
  hideEdgeTooltip();
}

function attachRendererHandlers(instance: Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>): void {
  instance.on("clickNode", ({ node }) => {
    emit("node-click", node);
  });

  instance.on("downNode", ({ node, event }) => {
    draggedNodeId = node;
    panningBeforeDrag = instance.getSetting("enableCameraPanning");
    instance.setSetting("enableCameraPanning", false);
    hideEdgeTooltip();
    stopAndDisposeLayout();
    event.preventSigmaDefault();
  });

  instance.on("moveBody", ({ event }) => {
    if (edgeTooltip.value.visible) {
      edgeTooltip.value = {
        ...edgeTooltip.value,
        x: event.x,
        y: event.y,
      };
    }

    if (!draggedNodeId) {
      return;
    }

    const graph = instance.getGraph();
    const graphPosition = instance.viewportToGraph({ x: event.x, y: event.y });
    graph.setNodeAttribute(draggedNodeId, "x", graphPosition.x);
    graph.setNodeAttribute(draggedNodeId, "y", graphPosition.y);
    event.preventSigmaDefault();
    instance.refresh();
  });

  instance.on("upNode", () => {
    stopDragging();
  });

  instance.on("upStage", () => {
    stopDragging();
  });

  instance.on("enterEdge", ({ edge, event }) => {
    const edgeAttributes = instance.getGraph().getEdgeAttributes(edge);
    edgeTooltip.value = {
      visible: true,
      x: event.x,
      y: event.y,
      kind: edgeAttributes.kind ?? null,
      txHash: edgeAttributes.txHash ?? null,
      weight: edgeAttributes.weight ?? null,
    };
  });

  instance.on("leaveEdge", () => {
    hideEdgeTooltip();
  });

  instance.on("clickStage", () => {
    hideEdgeTooltip();
  });
}

async function rebuildRenderer(): Promise<void> {
  const sequence = ++rebuildSequence;
  const container = containerRef.value;
  if (!container || isDisposed) {
    return;
  }

  await ensureRuntimeDeps();

  if (isDisposed || sequence !== rebuildSequence) {
    return;
  }

  const mountedContainer = containerRef.value;
  if (!mountedContainer || !sigmaCtor) {
    return;
  }

  const graph = buildSigmaGraph(props.nodes, props.edges);
  const options = normalizeLayoutOptions(props.layoutOptions);

  if (!renderer) {
    renderer = new sigmaCtor(graph, mountedContainer, {
      hideLabelsOnMove: true,
      hideEdgesOnMove: false,
      renderLabels: props.showLabels,
      renderEdgeLabels: false,
      defaultDrawNodeLabel: drawNodeLabelWithBackground,
      enableEdgeEvents: true,
      enableCameraPanning: true,
      enableCameraZooming: true,
      enableCameraRotation: false,
      autoRescale: options.autoRescale,
      autoCenter: options.autoCenter,
      labelDensity: 0.07,
      labelRenderedSizeThreshold: 10,
      zIndex: true,
    });

    attachRendererHandlers(renderer);
  } else {
    renderer.setGraph(graph);
  }

  applyRendererSettings();
  hideEdgeTooltip();
  startBoundedLayout(graph);
  renderer.refresh();
}

function scheduleRebuild(): void {
  void rebuildRenderer().catch((error: unknown) => {
    console.error("[SigmaGraphCanvas] Failed to initialize renderer.", error);
  });
}

watch(
  () => [props.nodes, props.edges],
  () => {
    scheduleRebuild();
  },
);

watch(
  () => props.layoutRunId,
  () => {
    if (!renderer) {
      return;
    }

    applyRendererSettings();
    startBoundedLayout(renderer.getGraph());
    renderer.refresh();
  },
);

watch(
  () => props.showLabels,
  () => {
    applyRendererSettings();
    renderer?.refresh();
  },
);

onMounted(() => {
  syncLabelColors();
  themeObserver = new MutationObserver(() => {
    syncLabelColors();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  scheduleRebuild();
});

onBeforeUnmount(() => {
  isDisposed = true;
  rebuildSequence += 1;
  stopDragging();
  hideEdgeTooltip();
  destroyRenderer();
  themeObserver?.disconnect();
  themeObserver = null;
});
</script>

<template>
  <div class="sigma-wrap">
    <div ref="containerRef" class="sigma-canvas" />
    <div v-if="edgeTooltip.visible" class="edge-tooltip" :style="{ left: `${edgeTooltip.x}px`, top: `${edgeTooltip.y}px` }">
      <div class="edge-tooltip-title">{{ toEdgeKindLabel(edgeTooltip.kind) }}</div>
      <div class="edge-tooltip-row">
        <span class="edge-tooltip-key">Weight</span>
        <span>{{ edgeTooltip.weight ?? "N/A" }}</span>
      </div>
      <div class="edge-tooltip-row">
        <span class="edge-tooltip-key">Tx</span>
        <code :title="edgeTooltip.txHash ?? undefined">{{ formatTooltipTxHash(edgeTooltip.txHash) }}</code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sigma-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.sigma-canvas {
  width: 100%;
  height: 100%;
}

.edge-tooltip {
  position: absolute;
  transform: translate(12px, -50%);
  max-width: 260px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.45rem 0.6rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  color: var(--color-text-primary);
  pointer-events: none;
  z-index: 10;
}

.edge-tooltip-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 0.3rem;
}

.edge-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.76rem;
  line-height: 1.2;
}

.edge-tooltip-key {
  color: var(--color-text-muted);
}

.edge-tooltip code {
  font-size: 0.72rem;
}
</style>
