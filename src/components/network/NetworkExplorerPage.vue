<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import MetricTile from "../shared/MetricTile.vue";
import NetworkGraphPanel from "./NetworkGraphPanel.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatNumber, formatPercent } from "../../lib/formatters";
import { useAsyncView } from "../../lib/view-state";
import type { NetworkGraphResponse } from "../../types/api";

const api = ScannerApiClient.fromEnv();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GLOBAL_EDGE_LIMIT = 250;
const FOCUSED_EDGE_LIMIT = 500;
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

const graphData = computed<NetworkGraphResponse | null>(() => state.data.value ?? null);
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

      <NetworkGraphPanel v-if="graphData" :graph="graphData" title="Global Trust Network" />
    </AsyncStateGate>
  </section>
</template>
