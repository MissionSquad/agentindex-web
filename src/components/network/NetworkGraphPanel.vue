<script setup lang="ts">
import { computed, ref } from "vue";
import { mapNetworkGraphToVNetworkGraph, createAgentNodeId } from "../../lib/graph-mapper";
import CopyButton from "../shared/CopyButton.vue";
import SigmaGraphCanvas from "./SigmaGraphCanvas.vue";
import { EDGE_KIND_COLORS, type ForceLayoutOptions, type GraphEdgeRow } from "../../types/graph";
import type { NetworkGraphResponse } from "../../types/api";
import type { GraphNode } from "../../types/graph";
import { formatAddress, formatNumber, formatTimestamp, formatTxHash } from "../../lib/formatters";

const props = defineProps<{
  graph: NetworkGraphResponse;
  focusAgentId?: string;
  title?: string;
}>();

const hopDepth = ref<"global" | "1" | "2">("global");
const kindFilters = ref<Array<"review" | "registrant" | "agent-review" | "response">>([
  "review",
  "registrant",
  "agent-review",
  "response",
]);

const kindOptions = [
  { title: "Review", value: "review" },
  { title: "Registrant", value: "registrant" },
  { title: "Agent Review", value: "agent-review" },
  { title: "Response", value: "response" },
];
const AUTO_LABEL_THRESHOLD = 80;

const NODE_KIND_COLORS: Record<GraphNode["kind"], string> = {
  agent: "#1D4ED8",
  address: "#0B5E67",
  feedback: "#64748B",
};
const showLabels = ref(false);
const nodeDetailOpen = ref(false);
const selectedNodeId = ref<string | null>(null);
const layoutRunId = ref(0);
const layoutOptions = ref<ForceLayoutOptions>({
  gravity: 1,
  scalingRatio: 1.2,
  slowDown: 2,
  barnesHutOptimize: true,
  barnesHutTheta: 0.7,
  useEdgeWeights: true,
  edgeWeightInfluence: 1,
  autoRescale: true,
  autoCenter: true,
  runtimeMs: 900,
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyLayoutControls(): void {
  const next = layoutOptions.value;
  layoutOptions.value = {
    gravity: Number.isFinite(next.gravity) ? clamp(next.gravity, 0, 10) : 1,
    scalingRatio: Number.isFinite(next.scalingRatio) ? clamp(next.scalingRatio, 0.1, 50) : 1.2,
    slowDown: Number.isFinite(next.slowDown) ? clamp(next.slowDown, 0.1, 50) : 2,
    barnesHutOptimize: next.barnesHutOptimize !== false,
    barnesHutTheta: Number.isFinite(next.barnesHutTheta) ? clamp(next.barnesHutTheta, 0.1, 2) : 0.7,
    useEdgeWeights: next.useEdgeWeights !== false,
    edgeWeightInfluence: Number.isFinite(next.edgeWeightInfluence) ? clamp(next.edgeWeightInfluence, 0, 4) : 1,
    autoRescale: next.autoRescale !== false,
    autoCenter: next.autoCenter !== false,
    runtimeMs: Number.isFinite(next.runtimeMs) ? clamp(Math.round(next.runtimeMs), 100, 5_000) : 900,
  };
  layoutRunId.value += 1;
}

function toNodeLabel(node: GraphNode): string {
  if (node.kind === "address" && node.name.startsWith("0x") && node.name.length > 12) {
    return `${node.name.slice(0, 8)}...${node.name.slice(-4)}`;
  }

  if (node.kind === "feedback" && node.name.length > 18) {
    return `${node.name.slice(0, 15)}...`;
  }

  return node.name;
}

function parseAgentIdFromNodeId(nodeId: string | null): string | null {
  if (!nodeId || !nodeId.startsWith("agent:")) {
    return null;
  }

  const parts = nodeId.split(":");
  return parts.length >= 3 ? parts[2] ?? null : null;
}

function parseAddressFromNodeId(nodeId: string | null): string | null {
  if (!nodeId || !nodeId.startsWith("address:")) {
    return null;
  }

  const address = nodeId.slice("address:".length);
  return address.length > 0 ? address : null;
}

const mapped = computed(() => mapNetworkGraphToVNetworkGraph(props.graph));

function buildAdjacency(edgeRows: GraphEdgeRow[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  edgeRows.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set<string>());
    }

    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set<string>());
    }

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  return adjacency;
}

function selectEgoNodeSet(root: string, depth: number, edgeRows: GraphEdgeRow[]): Set<string> {
  const adjacency = buildAdjacency(edgeRows);
  const visited = new Set<string>([root]);
  let frontier = new Set<string>([root]);

  for (let hop = 0; hop < depth; hop += 1) {
    const next = new Set<string>();

    frontier.forEach((nodeId) => {
      const neighbors = adjacency.get(nodeId);
      if (!neighbors) {
        return;
      }

      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.add(neighbor);
        }
      });
    });

    frontier = next;
    if (frontier.size === 0) {
      break;
    }
  }

  return visited;
}

const filteredEdgeRows = computed<GraphEdgeRow[]>(() => {
  const afterFilters = mapped.value.edgeRows.filter((edge) => {
    const kindMatch = kindFilters.value.includes(edge.kind);
    return kindMatch;
  });

  if (!props.focusAgentId || hopDepth.value === "global") {
    return afterFilters;
  }

  const rootNodeId = createAgentNodeId(1, props.focusAgentId);
  const depth = hopDepth.value === "1" ? 1 : 2;
  const egoNodes = selectEgoNodeSet(rootNodeId, depth, afterFilters);

  return afterFilters.filter((edge) => egoNodes.has(edge.source) && egoNodes.has(edge.target));
});

const renderedNodes = computed<Record<string, GraphNode>>(() => {
  const nodes: Record<string, GraphNode> = {};

  filteredEdgeRows.value.forEach((edge) => {
    const sourceNode = mapped.value.nodes[edge.source];
    const targetNode = mapped.value.nodes[edge.target];

    if (sourceNode) {
      nodes[edge.source] = sourceNode;
    }

    if (targetNode) {
      nodes[edge.target] = targetNode;
    }
  });

  return nodes;
});

const autoLabelsEnabled = computed(() => Object.keys(renderedNodes.value).length <= AUTO_LABEL_THRESHOLD);
const labelsEnabled = computed(() => autoLabelsEnabled.value || showLabels.value);
const labelsSuppressed = computed(() => !labelsEnabled.value);
const renderedEdges = computed<Record<string, GraphEdgeRow>>(() => {
  const edges: Record<string, GraphEdgeRow> = {};

  filteredEdgeRows.value.forEach((edge) => {
    edges[edge.id] = edge;
  });

  return edges;
});

function handleNodeClick(nodeId: string): void {
  if (!renderedNodes.value[nodeId]) {
    return;
  }

  selectedNodeId.value = nodeId;
  nodeDetailOpen.value = true;
}

const selectedNode = computed<GraphNode | null>(() => {
  const nodeId = selectedNodeId.value;
  if (!nodeId) return null;
  return renderedNodes.value[nodeId] ?? null;
});

const selectedNodeEdges = computed<GraphEdgeRow[]>(() => {
  const nodeId = selectedNodeId.value;
  if (!nodeId) return [];

  return filteredEdgeRows.value.filter((edge) => edge.source === nodeId || edge.target === nodeId);
});

const selectedNodeDisplayName = computed(() => {
  const node = selectedNode.value;
  return node ? toNodeLabel(node) : "Node Details";
});

const selectedNodeAgentId = computed(() => {
  const node = selectedNode.value;
  return node?.agentId ?? parseAgentIdFromNodeId(selectedNodeId.value);
});

const selectedNodeAddress = computed(() => {
  const node = selectedNode.value;
  return node?.address ?? parseAddressFromNodeId(selectedNodeId.value);
});

const selectedNodeRoute = computed(() => {
  if (selectedNode.value?.kind === "agent" && selectedNodeAgentId.value) {
    return `/agents/${selectedNodeAgentId.value}`;
  }

  if (selectedNode.value?.kind === "address" && selectedNodeAddress.value) {
    return `/address/${selectedNodeAddress.value}`;
  }

  return null;
});

const selectedNodeKindCounts = computed(() => {
  const counts: Record<GraphEdgeRow["kind"], number> = {
    review: 0,
    registrant: 0,
    "agent-review": 0,
    response: 0,
  };

  selectedNodeEdges.value.forEach((edge) => {
    counts[edge.kind] += 1;
  });

  return counts;
});

const selectedNodeStats = computed(() => {
  const nodeId = selectedNodeId.value;
  if (!nodeId) {
    return {
      inbound: 0,
      outbound: 0,
      firstSeen: null as number | null,
      lastSeen: null as number | null,
    };
  }

  let inbound = 0;
  let outbound = 0;
  let firstSeen: number | null = null;
  let lastSeen: number | null = null;

  selectedNodeEdges.value.forEach((edge) => {
    if (edge.target === nodeId) inbound += 1;
    if (edge.source === nodeId) outbound += 1;

    if (edge.firstSeen !== undefined && Number.isFinite(edge.firstSeen)) {
      firstSeen = firstSeen === null ? edge.firstSeen : Math.min(firstSeen, edge.firstSeen);
    }

    if (edge.lastSeen !== undefined && Number.isFinite(edge.lastSeen)) {
      lastSeen = lastSeen === null ? edge.lastSeen : Math.max(lastSeen, edge.lastSeen);
    }
  });

  return { inbound, outbound, firstSeen, lastSeen };
});

interface ConnectedNodeRow {
  nodeId: string;
  label: string;
  kind: GraphNode["kind"];
  edgeCount: number;
  edgeKinds: string;
}

const connectedNodes = computed<ConnectedNodeRow[]>(() => {
  const nodeId = selectedNodeId.value;
  if (!nodeId) return [];

  const byNode = new Map<string, { edgeCount: number; kinds: Set<GraphEdgeRow["kind"]> }>();

  selectedNodeEdges.value.forEach((edge) => {
    const neighborId = edge.source === nodeId ? edge.target : edge.source;
    const aggregate = byNode.get(neighborId) ?? { edgeCount: 0, kinds: new Set<GraphEdgeRow["kind"]>() };
    aggregate.edgeCount += 1;
    aggregate.kinds.add(edge.kind);
    byNode.set(neighborId, aggregate);
  });

  return Array.from(byNode.entries())
    .map(([neighborId, aggregate]) => {
      const neighborNode = renderedNodes.value[neighborId];
      return {
        nodeId: neighborId,
        label: neighborNode ? toNodeLabel(neighborNode) : neighborId,
        kind: neighborNode?.kind ?? "feedback",
        edgeCount: aggregate.edgeCount,
        edgeKinds: Array.from(aggregate.kinds.values()).join(", "),
      };
    })
    .sort((left, right) => right.edgeCount - left.edgeCount)
    .slice(0, 12);
});

const selectedNodeMetaRows = computed<Array<{ key: string; value: string }>>(() => {
  const meta = selectedNode.value?.meta;
  if (!meta) return [];

  return Object.entries(meta).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
});

function edgeNodeDisplayName(nodeId: string): string {
  const node = renderedNodes.value[nodeId];
  if (node) {
    return toNodeLabel(node);
  }

  const agentId = parseAgentIdFromNodeId(nodeId);
  if (agentId) return `Agent ${agentId}`;

  const address = parseAddressFromNodeId(nodeId);
  if (address) return formatAddress(address);

  return nodeId;
}

const edgeHeaders = [
  { title: "Source", key: "source" },
  { title: "Target", key: "target" },
  { title: "Kind", key: "kind" },
  { title: "Weight", key: "weight" },
  { title: "First Seen", key: "firstSeen" },
  { title: "Last Seen", key: "lastSeen" },
  { title: "Tx Hash", key: "txHash" },
];
</script>

<template>
  <v-card border>
    <v-card-title>{{ props.title ?? "Trust Network" }}</v-card-title>
    <v-card-text>
      <div class="legend">
        <div v-for="kind in kindOptions" :key="kind.value" class="legend-item">
          <span class="swatch" :style="{ backgroundColor: EDGE_KIND_COLORS[kind.value] }" />
          <span>{{ kind.title }}</span>
        </div>
      </div>

      <div class="graph-wrap">
        <SigmaGraphCanvas
          :nodes="renderedNodes"
          :edges="renderedEdges"
          :show-labels="labelsEnabled"
          :layout-options="layoutOptions"
          :layout-run-id="layoutRunId"
          @node-click="handleNodeClick"
        />
      </div>

      <v-expansion-panels class="mt-3" variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>Graph Controls</v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row dense>
              <v-col cols="12" md="6" v-if="props.focusAgentId">
                <v-select
                  v-model="hopDepth"
                  :items="[
                    { title: 'Global', value: 'global' },
                    { title: '1-hop ego', value: '1' },
                    { title: '2-hop ego', value: '2' },
                  ]"
                  label="Ego View"
                />
              </v-col>
              <v-col cols="12" :md="props.focusAgentId ? 6 : 12">
                <v-select v-model="kindFilters" :items="kindOptions" label="Edge Kinds" multiple />
              </v-col>

              <v-col cols="12" md="3">
                <v-switch
                  v-model="showLabels"
                  color="primary"
                  hide-details
                  inset
                  label="Force node labels"
                />
                <p v-if="labelsSuppressed" class="label-hint mt-1">Labels are hidden for readability.</p>
              </v-col>
              <v-col cols="12" md="3">
                <v-switch
                  v-model="layoutOptions.useEdgeWeights"
                  color="primary"
                  hide-details
                  inset
                  label="Use edge weights"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-switch
                  v-model="layoutOptions.autoRescale"
                  color="primary"
                  hide-details
                  inset
                  label="Auto rescale"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-switch
                  v-model="layoutOptions.autoCenter"
                  color="primary"
                  hide-details
                  inset
                  label="Auto center"
                />
              </v-col>

              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.gravity"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  density="comfortable"
                  label="Gravity"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.scalingRatio"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  density="comfortable"
                  label="Scaling Ratio"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.slowDown"
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  density="comfortable"
                  label="Slow Down"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.barnesHutTheta"
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  density="comfortable"
                  label="BH Theta"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.edgeWeightInfluence"
                  type="number"
                  min="0"
                  max="4"
                  step="0.1"
                  density="comfortable"
                  label="Weight Influence"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="layoutOptions.runtimeMs"
                  type="number"
                  min="100"
                  max="5000"
                  step="50"
                  density="comfortable"
                  label="Runtime (ms)"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-switch
                  v-model="layoutOptions.barnesHutOptimize"
                  color="primary"
                  hide-details
                  inset
                  label="Barnes-Hut Optimize"
                />
              </v-col>
              <v-col cols="12" md="9" class="d-flex justify-end align-center">
                <v-btn color="primary" variant="tonal" @click="applyLayoutControls">Apply Layout</v-btn>
              </v-col>
            </v-row>

            <p class="interaction-hint mt-2">
              Drag nodes to reposition manually. Click Apply Layout to rerun force placement using the current controls.
            </p>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <p class="interaction-hint mt-2">Click any node to inspect details in an overlay.</p>

      <v-data-table :headers="edgeHeaders" :items="filteredEdgeRows" class="mt-4" density="comfortable">
        <template #item.source="{ item }">
          <a v-if="parseAddressFromNodeId(item.source)" :href="`/address/${parseAddressFromNodeId(item.source)}`">
            {{ edgeNodeDisplayName(item.source) }}
          </a>
          <a v-else-if="parseAgentIdFromNodeId(item.source)" :href="`/agents/${parseAgentIdFromNodeId(item.source)}`">
            {{ edgeNodeDisplayName(item.source) }}
          </a>
          <span v-else>{{ item.source }}</span>
        </template>
        <template #item.target="{ item }">
          <a v-if="parseAgentIdFromNodeId(item.target)" :href="`/agents/${parseAgentIdFromNodeId(item.target)}`">
            {{ edgeNodeDisplayName(item.target) }}
          </a>
          <a v-else-if="parseAddressFromNodeId(item.target)" :href="`/address/${parseAddressFromNodeId(item.target)}`">
            {{ edgeNodeDisplayName(item.target) }}
          </a>
          <span v-else>{{ item.target }}</span>
        </template>
        <template #item.kind="{ item }">
          <v-chip size="small" :color="EDGE_KIND_COLORS[item.kind]" text-color="white">{{ item.kind }}</v-chip>
        </template>
        <template #item.weight="{ item }">
          {{ formatNumber(item.weight ?? 1) }}
        </template>
        <template #item.firstSeen="{ item }">
          {{ formatTimestamp(item.firstSeen) }}
        </template>
        <template #item.lastSeen="{ item }">
          {{ formatTimestamp(item.lastSeen) }}
        </template>
        <template #item.txHash="{ item }">
          <a v-if="item.txHash" :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a>
          <CopyButton v-if="item.txHash" :value="item.txHash" />
          <span v-if="!item.txHash">N/A</span>
        </template>
      </v-data-table>

      <v-dialog v-model="nodeDetailOpen" max-width="760">
        <v-card v-if="selectedNode && selectedNodeId">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>{{ selectedNodeDisplayName }}</span>
            <v-chip size="small" :color="NODE_KIND_COLORS[selectedNode.kind]" text-color="white">{{ selectedNode.kind }}</v-chip>
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col cols="12" md="7">
                <div class="detail-block">
                  <div class="detail-label">Node ID</div>
                  <code class="detail-code">{{ selectedNodeId }}</code>
                  <CopyButton :value="selectedNodeId" />
                </div>
              </v-col>
              <v-col cols="12" md="5">
                <div class="detail-block">
                  <div class="detail-label">Open Profile</div>
                  <a v-if="selectedNodeRoute" :href="selectedNodeRoute" class="detail-link">{{ selectedNodeRoute }}</a>
                  <span v-else>N/A</span>
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="detail-block">
                  <div class="detail-label">Degree</div>
                  <div>{{ formatNumber(selectedNodeEdges.length) }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="detail-block">
                  <div class="detail-label">Inbound</div>
                  <div>{{ formatNumber(selectedNodeStats.inbound) }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="detail-block">
                  <div class="detail-label">Outbound</div>
                  <div>{{ formatNumber(selectedNodeStats.outbound) }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="6" v-if="selectedNode.kind === 'agent'">
                <div class="detail-block">
                  <div class="detail-label">Agent ID</div>
                  <div>{{ selectedNodeAgentId ?? "N/A" }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="6" v-if="selectedNode.kind === 'address'">
                <div class="detail-block">
                  <div class="detail-label">Address</div>
                  <div>{{ formatAddress(selectedNodeAddress) }} <CopyButton v-if="selectedNodeAddress" :value="selectedNodeAddress" /></div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="detail-block">
                  <div class="detail-label">First Seen</div>
                  <div>{{ formatTimestamp(selectedNodeStats.firstSeen) }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="detail-block">
                  <div class="detail-label">Last Seen</div>
                  <div>{{ formatTimestamp(selectedNodeStats.lastSeen) }}</div>
                </div>
              </v-col>
            </v-row>

            <div class="detail-block">
              <div class="detail-label">Edge Kinds</div>
              <div class="chip-row">
                <v-chip size="small" variant="outlined" :color="EDGE_KIND_COLORS.review">
                  Review: {{ formatNumber(selectedNodeKindCounts.review) }}
                </v-chip>
                <v-chip size="small" variant="outlined" :color="EDGE_KIND_COLORS.registrant">
                  Registrant: {{ formatNumber(selectedNodeKindCounts.registrant) }}
                </v-chip>
                <v-chip size="small" variant="outlined" :color="EDGE_KIND_COLORS['agent-review']">
                  Agent Review: {{ formatNumber(selectedNodeKindCounts['agent-review']) }}
                </v-chip>
                <v-chip size="small" variant="outlined" :color="EDGE_KIND_COLORS.response">
                  Response: {{ formatNumber(selectedNodeKindCounts.response) }}
                </v-chip>
              </div>
            </div>

            <div class="detail-block">
              <div class="detail-label">Connected Nodes (Top 12)</div>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Kind</th>
                    <th>Edges</th>
                    <th>Edge Types</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in connectedNodes" :key="row.nodeId">
                    <td>{{ row.label }}</td>
                    <td>{{ row.kind }}</td>
                    <td>{{ formatNumber(row.edgeCount) }}</td>
                    <td>{{ row.edgeKinds }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <div class="detail-block" v-if="selectedNodeMetaRows.length > 0">
              <div class="detail-label">Metadata</div>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in selectedNodeMetaRows" :key="row.key">
                    <td>{{ row.key }}</td>
                    <td>{{ row.value }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="nodeDetailOpen = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.graph-wrap {
  height: 520px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-alt);
  overflow: hidden;
}

@media (max-width: 599px) {
  .graph-wrap {
    height: 320px;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.label-hint {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.interaction-hint {
  margin: 0.5rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.detail-block {
  margin-top: 0.75rem;
}

.detail-label {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.detail-code {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
  word-break: break-all;
}

.detail-link {
  color: var(--color-link);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
