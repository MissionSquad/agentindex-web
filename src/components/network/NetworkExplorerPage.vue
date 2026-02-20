<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import MetricTile from "../shared/MetricTile.vue";
import NetworkGraphPanel from "./NetworkGraphPanel.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatNumber, formatPercent } from "../../lib/formatters";
import { useAsyncView } from "../../lib/view-state";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import { extractAgentUriMetadata } from "../../lib/uri-metadata";
import type { NetworkGraphResponse } from "../../types/api";

const api = ScannerApiClient.fromEnv();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GLOBAL_EDGE_LIMIT = 250;
const FOCUSED_EDGE_LIMIT = 500;
const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);
const timeWindowOptions = [
  { title: "1 day", value: 1 },
  { title: "2 days", value: 2 },
  { title: "3 days", value: 3 },
  { title: "7 days", value: 7 },
  { title: "14 days", value: 14 },
];

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function toLocalDateTimeInputValue(timestampMs: number): string {
  const dt = new Date(timestampMs);
  const yyyy = dt.getFullYear();
  const mm = pad2(dt.getMonth() + 1);
  const dd = pad2(dt.getDate());
  const hh = pad2(dt.getHours());
  const min = pad2(dt.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseDateInputToMs(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const filters = reactive({
  minWeight: 1,
  trailingDays: 3,
  windowStart: toLocalDateTimeInputValue(Date.now()),
  agentId: "",
  address: "",
});

const state = useAsyncView<NetworkGraphResponse>(
  () => {
    const hasScope = filters.agentId.trim().length > 0 || filters.address.trim().length > 0;
    const anchorMs = parseDateInputToMs(filters.windowStart) ?? Date.now();
    const sinceMs = anchorMs - filters.trailingDays * MS_PER_DAY;
    const since = Math.floor(sinceMs / 1000);
    const until = Math.floor(anchorMs / 1000);

    return api.getNetworkGraph({
      minWeight: filters.minWeight,
      since,
      until,
      limit: hasScope ? FOCUSED_EDGE_LIMIT : GLOBAL_EDGE_LIMIT,
      agentId: filters.agentId || undefined,
      address: filters.address || undefined,
    });
  },
  (payload) => payload.edges.length === 0,
  false,
);

watch(
  () => [filters.minWeight, filters.trailingDays, filters.windowStart, filters.agentId, filters.address],
  () => {
    void state.refresh();
  },
);

onMounted(() => {
  void state.refresh();
});

// Resolve agent URIs to get JSON-derived names for graph nodes
const agentNameMap = ref(new Map<string, string>());

async function resolveAgentName(agentId: string): Promise<string | null> {
  try {
    const profile = await api.getAgent(agentId);
    const agentUri = profile.currentUri || profile.agent.agentUri;
    if (!agentUri) return null;

    let resolved = resolveAgentUri(agentUri);

    if (needsAsyncDataResolve(resolved)) {
      try {
        resolved = await resolveDataUriAsync(agentUri);
      } catch {
        return null;
      }
    }

    if (FETCHABLE_SCHEMES.has(resolved.scheme) && resolved.decoded === null && !resolved.error) {
      try {
        const fetched = await api.resolveUri(resolved.raw);
        if (fetched.contentType === "application/json" && fetched.body !== null) {
          resolved = { scheme: resolved.scheme, raw: resolved.raw, decoded: fetched.body, error: null };
        }
      } catch {
        return null;
      }
    }

    const metadata = extractAgentUriMetadata(resolved.decoded);
    return metadata.name;
  } catch {
    return null;
  }
}

watch(
  () => state.data.value,
  async (graphData) => {
    if (!graphData) return;

    const agentIds = new Set<string>();
    graphData.nodes.forEach((node) => {
      if ((node.kind === "agent" || (!node.kind && node.agentId)) && node.agentId && !node.name) {
        agentIds.add(node.agentId);
      }
    });

    // Also scan edges for agent IDs that may not have nodes
    graphData.edges.forEach((edge) => {
      const sourceMatch = edge.source.match(/^(?:agent:\d+:)?(\d+)$/);
      const targetMatch = edge.target.match(/^(?:agent:\d+:)?(\d+)$/);
      if (sourceMatch?.[1]) agentIds.add(sourceMatch[1]);
      if (targetMatch?.[1]) agentIds.add(targetMatch[1]);
    });

    if (agentIds.size === 0) return;

    const map = new Map<string, string>();

    await Promise.all(
      Array.from(agentIds).map(async (agentId) => {
        const name = await resolveAgentName(agentId);
        if (name) {
          map.set(agentId, name);
        }
      }),
    );

    agentNameMap.value = map;
  },
  { immediate: true },
);

// Build enriched graph with resolved names injected into nodes
const enrichedGraph = computed<NetworkGraphResponse | null>(() => {
  const raw = state.data.value;
  if (!raw) return null;

  if (agentNameMap.value.size === 0) return raw;

  // Enrich existing nodes with resolved names
  const enrichedNodes = raw.nodes.map((node) => {
    if (node.agentId && agentNameMap.value.has(node.agentId)) {
      return { ...node, name: agentNameMap.value.get(node.agentId) };
    }

    return node;
  });

  // Collect agent IDs already present in the nodes array
  const existingAgentIds = new Set<string>();
  enrichedNodes.forEach((node) => {
    if (node.agentId) existingAgentIds.add(node.agentId);
  });

  // Add synthetic nodes for agents that only appear in edges
  agentNameMap.value.forEach((name, agentId) => {
    if (!existingAgentIds.has(agentId)) {
      enrichedNodes.push({ kind: "agent", agentId, name });
    }
  });

  return {
    ...raw,
    nodes: enrichedNodes,
  };
});
</script>

<template>
  <section>
    <v-card border class="mb-4">
      <v-card-title>Network Filters</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="3">
            <v-text-field v-model.number="filters.minWeight" type="number" min="1" label="Minimum Edge Weight" />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="filters.windowStart"
              label="Window End (local)"
              type="datetime-local"
              hint="Show edges from the preceding N days up to this point."
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.trailingDays"
              :items="timeWindowOptions"
              label="Window Size"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="filters.agentId" label="Agent ID" />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="filters.address" label="Address" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No network edges"
      empty-description="No trust edges matched the current filter settings."
      @retry="state.refresh"
    >
      <v-alert v-if="state.data.value?.meta.truncated" type="info" variant="tonal" border="start" class="mb-3">
        Showing top {{ formatNumber(state.data.value.meta.edgeLimitApplied) }} edges for this query. Narrow the filters
        to render a smaller graph.
      </v-alert>

      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <MetricTile
            label="Reciprocal Review Ratio (Global)"
            :value="formatPercent(state.data.value?.metrics.reciprocalReviewRatioGlobal)"
          />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile label="Isolated Cluster Share" :value="formatPercent(state.data.value?.metrics.isolatedClusterShare)" />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile label="Network Bridge Count" :value="formatNumber(state.data.value?.metrics.networkBridgeCount)" />
        </v-col>
      </v-row>

      <NetworkGraphPanel v-if="enrichedGraph" :graph="enrichedGraph" title="Global Trust Network" />
    </AsyncStateGate>
  </section>
</template>
