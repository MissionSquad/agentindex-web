<script setup lang="ts">
import { computed, ref } from "vue";
import type { TimeSeriesPoint } from "../../types/api";
import type { ChartRenderState } from "../../lib/chart-state";
import { formatNumber, normalizeEpochToMs } from "../../lib/formatters";

const props = withDefaults(
  defineProps<{
    title: string;
    points: TimeSeriesPoint[];
    color?: string;
    state: ChartRenderState;
    emptyMessage?: string;
    maxPoints?: number;
  }>(),
  {
    color: "#0b5e67",
    maxPoints: 120,
  },
);

const PADDING = { top: 20, right: 16, bottom: 32, left: 48 };
const SVG_WIDTH = 400;
const SVG_HEIGHT = 200;

const chartWidth = SVG_WIDTH - PADDING.left - PADDING.right;
const chartHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;

const capped = computed<TimeSeriesPoint[]>(() => {
  const source = props.points;
  if (source.length <= props.maxPoints) {
    return source;
  }
  return source.slice(source.length - props.maxPoints);
});

const yExtent = computed<{ min: number; max: number }>(() => {
  const values = capped.value.map((p) => p.value);
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min: Math.min(min, 0), max: max === min ? max + 1 : max };
});

function xPos(index: number): number {
  const count = capped.value.length;
  if (count <= 1) {
    return PADDING.left + chartWidth / 2;
  }
  return PADDING.left + (index / (count - 1)) * chartWidth;
}

function yPos(value: number): number {
  const { min, max } = yExtent.value;
  const ratio = (value - min) / (max - min);
  return PADDING.top + chartHeight - ratio * chartHeight;
}

const polylinePoints = computed<string>(() =>
  capped.value.map((p, i) => `${xPos(i)},${yPos(p.value)}`).join(" "),
);

const nodeMarkers = computed(() =>
  capped.value.map((p, i) => ({
    cx: xPos(i),
    cy: yPos(p.value),
    index: i,
  })),
);

const Y_GRID_COUNT = 4;

const yGridlines = computed(() => {
  const { min, max } = yExtent.value;
  const lines: Array<{ y: number; label: string }> = [];
  for (let i = 0; i <= Y_GRID_COUNT; i++) {
    const value = min + ((max - min) * i) / Y_GRID_COUNT;
    lines.push({
      y: yPos(value),
      label: formatNumber(value),
    });
  }
  return lines;
});

const X_TICK_COUNT = 5;

const xTicks = computed(() => {
  const pts = capped.value;
  if (pts.length === 0) {
    return [];
  }

  const step = Math.max(1, Math.floor((pts.length - 1) / (X_TICK_COUNT - 1)));
  const ticks: Array<{ x: number; label: string }>= [];
  for (let i = 0; i < pts.length; i += step) {
    const p = pts[i]!;
    const label = p.label ?? formatDate(p.timestamp);
    ticks.push({ x: xPos(i), label });
  }
  return ticks;
});

function formatDate(epoch: number): string {
  const ms = normalizeEpochToMs(epoch);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "";
  }
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const hoverIndex = ref<number | null>(null);

const tooltip = computed(() => {
  if (hoverIndex.value === null) {
    return null;
  }

  const p = capped.value[hoverIndex.value];
  if (!p) {
    return null;
  }

  const ms = normalizeEpochToMs(p.timestamp);
  const date = Number.isFinite(ms) && ms > 0
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms))
    : "Unknown";

  return {
    x: xPos(hoverIndex.value),
    y: yPos(p.value) - 10,
    text: `${date}: ${formatNumber(p.value)}`,
  };
});

const emptyText = computed<string>(() => {
  if (props.emptyMessage) {
    return props.emptyMessage;
  }
  if (props.state === "zero-events") {
    return "No events in selected window.";
  }
  return "Not computed yet for current sync window.";
});
</script>

<template>
  <v-card border>
    <v-card-title class="text-subtitle-1">{{ props.title }}</v-card-title>
    <v-card-text>
      <div v-if="props.state !== 'ready'" class="empty-state">
        <span>{{ emptyText }}</span>
      </div>
      <svg
        v-else
        :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
        class="line-chart-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Y gridlines -->
        <g class="gridlines">
          <line
            v-for="(gl, gi) in yGridlines"
            :key="`yg-${gi}`"
            :x1="PADDING.left"
            :x2="PADDING.left + chartWidth"
            :y1="gl.y"
            :y2="gl.y"
          />
        </g>

        <!-- Y axis tick labels -->
        <g class="y-labels">
          <text
            v-for="(gl, gi) in yGridlines"
            :key="`yl-${gi}`"
            :x="PADDING.left - 4"
            :y="gl.y + 3"
            text-anchor="end"
          >{{ gl.label }}</text>
        </g>

        <!-- X axis tick labels -->
        <g class="x-labels">
          <text
            v-for="(tick, ti) in xTicks"
            :key="`xl-${ti}`"
            :x="tick.x"
            :y="SVG_HEIGHT - 4"
            text-anchor="middle"
          >{{ tick.label }}</text>
        </g>

        <!-- Polyline -->
        <polyline
          :points="polylinePoints"
          fill="none"
          :stroke="props.color"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Node markers + hover zones -->
        <g class="markers">
          <circle
            v-for="marker in nodeMarkers"
            :key="`m-${marker.index}`"
            :cx="marker.cx"
            :cy="marker.cy"
            :r="hoverIndex === marker.index ? 4 : 2.5"
            :fill="props.color"
            class="marker-dot"
            @mouseenter="hoverIndex = marker.index"
            @mouseleave="hoverIndex = null"
          />
        </g>

        <!-- Tooltip -->
        <g v-if="tooltip" class="tooltip-group">
          <rect
            :x="Math.max(PADDING.left, Math.min(tooltip.x - 60, SVG_WIDTH - PADDING.right - 120))"
            :y="tooltip.y - 16"
            width="120"
            height="20"
            rx="4"
            class="tooltip-bg"
          />
          <text
            :x="Math.max(PADDING.left + 60, Math.min(tooltip.x, SVG_WIDTH - PADDING.right - 60))"
            :y="tooltip.y - 3"
            text-anchor="middle"
            class="tooltip-text"
          >{{ tooltip.text }}</text>
        </g>
      </svg>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.line-chart-svg {
  width: 100%;
  height: auto;
  min-height: 180px;
}

.gridlines line {
  stroke: var(--color-border-subtle);
  stroke-width: 1;
}

.y-labels text {
  font-size: 8px;
  fill: var(--color-text-muted);
}

.x-labels text {
  font-size: 7.5px;
  fill: var(--color-text-muted);
}

.marker-dot {
  cursor: pointer;
  transition: r 0.1s;
}

.tooltip-bg {
  fill: var(--color-text-primary);
  opacity: 0.9;
}

.tooltip-text {
  font-size: 7.5px;
  fill: var(--color-surface);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: var(--color-text-muted);
  font-size: 0.88rem;
}
</style>
