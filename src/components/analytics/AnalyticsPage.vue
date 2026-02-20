<script setup lang="ts">
import { computed } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import LineSeriesChart from "../shared/LineSeriesChart.vue";
import HeatmapTable from "../shared/HeatmapTable.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatComputedNumber, formatComputedPercent, formatNumber } from "../../lib/formatters";
import { resolveChartState } from "../../lib/chart-state";
import type { ChartStateContext } from "../../lib/chart-state";
import { useAsyncView } from "../../lib/view-state";
import type { AnalyticsOverviewResponse } from "../../types/api";

const api = ScannerApiClient.fromEnv();

const state = useAsyncView<AnalyticsOverviewResponse>(
  () => api.getAnalyticsOverview(),
  (payload) => payload.charts.registrations.length === 0,
);

const chartCtx = computed<ChartStateContext>(() => ({
  dashboardMetrics: state.data.value?.dashboardMetrics ?? {
    totalRegisteredAgents: 0, newAgents24h: 0, newAgents7d: 0, newAgents30d: 0,
    totalFeedbackSubmitted: 0, activeFeedback: 0, uniqueClientAddresses: 0,
    totalResponsesAppended: 0, agentTransfers: 0,
  },
  heuristics: state.data.value?.heuristics ?? {
    ecosystemGrowthVelocity: null, feedbackDensity: null, revocationRate: null,
    dormantAgentRatio: null, responseEngagementRate: null, transferRate: null,
    networkGiniCoefficient: null, responderConcentration: null,
  },
}));

const registrationsState = computed(() =>
  resolveChartState("registrations", state.data.value?.charts.registrations ?? [], chartCtx.value),
);
const feedbackVolumeState = computed(() =>
  resolveChartState("feedbackVolume", state.data.value?.charts.feedbackVolume ?? [], chartCtx.value),
);
const responseVolumeState = computed(() =>
  resolveChartState("responseVolume", state.data.value?.charts.responseVolume ?? [], chartCtx.value),
);
const transferVolumeState = computed(() =>
  resolveChartState("transferVolume", state.data.value?.charts.transferVolume ?? [], chartCtx.value),
);
const activeAgentsState = computed(() =>
  resolveChartState("activeAgents", state.data.value?.charts.activeAgents ?? [], chartCtx.value),
);
const clientGrowthState = computed(() =>
  resolveChartState("clientGrowth", state.data.value?.charts.clientGrowth ?? [], chartCtx.value),
);
const responderGrowthState = computed(() =>
  resolveChartState("responderGrowth", state.data.value?.charts.responderGrowth ?? [], chartCtx.value),
);
const integrityHealthState = computed(() =>
  resolveChartState("integrityHealth", state.data.value?.charts.integrityHealth ?? [], chartCtx.value),
);
const feedbackVelocityState = computed(() =>
  resolveChartState("selectedAgentFeedbackVelocity", state.data.value?.charts.selectedAgentFeedbackVelocity ?? [], chartCtx.value),
);
const revocationVolumeState = computed(() =>
  resolveChartState("revocationVolume", state.data.value?.charts.revocationVolume ?? [], chartCtx.value),
);

const heuristicRows = computed(() => {
  const data = state.data.value;
  if (!data) {
    return [];
  }

  return [
    { label: "Growth Velocity", value: formatComputedNumber(data.heuristics.ecosystemGrowthVelocity) },
    { label: "Feedback Density", value: formatComputedNumber(data.heuristics.feedbackDensity) },
    { label: "Dormant Agent Ratio", value: formatComputedPercent(data.heuristics.dormantAgentRatio) },
    { label: "Response Engagement", value: formatComputedPercent(data.heuristics.responseEngagementRate) },
    { label: "Transfer Rate", value: formatComputedPercent(data.heuristics.transferRate) },
    { label: "Network Gini", value: formatComputedNumber(data.heuristics.networkGiniCoefficient) },
  ];
});
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No analytics data"
      empty-description="Analytics series are not available yet."
      @retry="state.refresh"
    >
      <!-- Heuristics: compact horizontal row -->
      <v-card border class="mb-3">
        <v-card-title class="text-subtitle-1 pb-0">Global Heuristics</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="6" md="2" v-for="row in heuristicRows" :key="row.label">
              <div class="heuristic-cell">
                <span class="heuristic-label">{{ row.label }}</span>
                <strong class="heuristic-value">{{ row.value }}</strong>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Primary time-series charts -->
      <v-row dense>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Agent Registrations" :points="state.data.value?.charts.registrations ?? []" :state="registrationsState.state" />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Feedback Volume" :points="state.data.value?.charts.feedbackVolume ?? []" :state="feedbackVolumeState.state" color="#ff7a45" />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Response Volume" :points="state.data.value?.charts.responseVolume ?? []" :state="responseVolumeState.state" color="#0f766e" />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Transfer Volume" :points="state.data.value?.charts.transferVolume ?? []" :state="transferVolumeState.state" color="#b45309" />
        </v-col>
      </v-row>

      <!-- Secondary analytics — collapsed by default -->
      <v-expansion-panels class="mt-3" variant="accordion">
        <v-expansion-panel title="Secondary Analytics">
          <v-expansion-panel-text>
            <v-row dense>
              <v-col cols="12" md="4">
                <LineSeriesChart title="Active Agents (30d)" :points="state.data.value?.charts.activeAgents ?? []" :state="activeAgentsState.state" color="#1d4ed8" />
              </v-col>
              <v-col cols="12" md="4">
                <LineSeriesChart title="Client Growth" :points="state.data.value?.charts.clientGrowth ?? []" :state="clientGrowthState.state" color="#0b5e67" />
              </v-col>
              <v-col cols="12" md="4">
                <LineSeriesChart title="Responder Growth" :points="state.data.value?.charts.responderGrowth ?? []" :state="responderGrowthState.state" color="#065f46" />
              </v-col>
              <v-col cols="12" md="4">
                <LineSeriesChart title="Integrity Health" :points="state.data.value?.charts.integrityHealth ?? []" :state="integrityHealthState.state" color="#0284c7" />
              </v-col>
              <v-col cols="12" md="4">
                <LineSeriesChart title="Agent Feedback Velocity" :points="state.data.value?.charts.selectedAgentFeedbackVelocity ?? []" :state="feedbackVelocityState.state" color="#334155" />
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- Revocation — collapsed, last -->
      <v-expansion-panels class="mt-3" variant="accordion">
        <v-expansion-panel title="Revocation (Low Activity)">
          <v-expansion-panel-text>
            <v-row dense>
              <v-col cols="12" md="4">
                <div class="heuristic-cell">
                  <span class="heuristic-label">Revocation Rate</span>
                  <strong class="heuristic-value">{{ formatComputedPercent(state.data.value?.heuristics.revocationRate) }}</strong>
                </div>
              </v-col>
              <v-col cols="12" md="8">
                <LineSeriesChart title="Revocation Volume" :points="state.data.value?.charts.revocationVolume ?? []" :state="revocationVolumeState.state" color="#b42318" />
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-row dense class="mt-2">
        <v-col cols="12" md="4">
          <v-card border>
            <v-card-title>Top Agents by Feedback</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item
                  v-for="row in state.data.value?.charts.topAgentsByFeedback.slice(0, 15) ?? []"
                  :key="row.agentId"
                >
                  <template #title>Agent {{ row.agentId }}</template>
                  <template #append>{{ formatNumber(row.value) }}</template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <HeatmapTable title="Tag Heatmap" :rows="state.data.value?.charts.tagHeatmap ?? []" />
        </v-col>

        <v-col cols="12" md="4">
          <HeatmapTable title="Endpoint Heatmap" :rows="state.data.value?.charts.endpointHeatmap ?? []" />
        </v-col>
      </v-row>

      <v-row dense class="mt-2">
        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>Protocol Distribution</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item
                  v-for="row in state.data.value?.charts.protocolDistribution ?? []"
                  :key="`protocol-${row.label}`"
                >
                  <template #title>{{ row.label }}</template>
                  <template #append>{{ formatNumber(row.value) }}</template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>Time to First Feedback</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item
                  v-for="row in state.data.value?.charts.timeToFirstFeedbackDistribution ?? []"
                  :key="`ttff-${row.label}`"
                >
                  <template #title>{{ row.label }}</template>
                  <template #append>{{ formatNumber(row.value) }}</template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </AsyncStateGate>
  </section>
</template>

<style scoped>
.heuristic-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.25rem 0;
}

.heuristic-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-label);
}

.heuristic-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}
</style>
