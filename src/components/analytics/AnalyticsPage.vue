<script setup lang="ts">
import { computed } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import LineSeriesChart from "../shared/LineSeriesChart.vue";
import TagTreemap from "../shared/TagTreemap.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatComputedNumber, formatComputedPercent, formatNumber, formatPercent } from "../../lib/formatters";
import { resolveChartState } from "../../lib/chart-state";
import type { ChartStateContext } from "../../lib/chart-state";
import { useAsyncView } from "../../lib/view-state";
import type { AnalyticsOverviewResponse, TopAgentSummary, WindowedValue } from "../../types/api";

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

function formatWindowedNumber(value: WindowedValue): string {
  return `${formatComputedNumber(value.d24h)} / ${formatComputedNumber(value.d7d)} / ${formatComputedNumber(value.d30d)}`;
}

function formatWindowedPercent(value: WindowedValue): string {
  return `${formatComputedPercent(value.d24h)} / ${formatComputedPercent(value.d7d)} / ${formatComputedPercent(value.d30d)}`;
}

const windowedHeuristicRows = computed(() => {
  const w = state.data.value?.windowedHeuristics;
  if (!w) return [];

  return [
    { label: "Ecosystem Growth Velocity", value: formatWindowedNumber(w.ecosystemGrowthVelocity) },
    { label: "Feedback Density", value: formatWindowedNumber(w.feedbackDensity) },
    { label: "Dormant Agent Ratio", value: formatWindowedPercent(w.dormantAgentRatio) },
    { label: "Response Engagement Rate", value: formatWindowedPercent(w.responseEngagementRate) },
    { label: "Transfer Rate", value: formatWindowedPercent(w.transferRate) },
  ];
});

const pointHeuristicRows = computed(() => {
  const data = state.data.value;
  if (!data) return [];

  return [
    { label: "Network Gini", value: formatComputedNumber(data.heuristics.networkGiniCoefficient) },
    { label: "Responder Concentration", value: formatComputedNumber(data.heuristics.responderConcentration) },
  ];
});

// Top agents tables (matching Dashboard pattern)
const topAgents = computed(() => state.data.value?.charts.topAgentsByFeedback ?? []);

const topAgentsByReputation = computed(() => {
  const agents = state.data.value?.charts.topAgentsByFeedback ?? [];
  return [...agents]
    .filter((a) => a.reputationScore !== null)
    .sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0))
    .slice(0, 10);
});

function agentName(agent: TopAgentSummary): string {
  return agent.name ?? `Agent ${agent.agentId}`;
}

function agentImage(agent: TopAgentSummary): string | null {
  if (!agent.imageUrl) return null;
  if (agent.imageUrl.startsWith("data:")) return agent.imageUrl;
  return api.imageProxyUrl(agent.imageUrl);
}

const topAgentHeaders = [
  { title: "", key: "image", sortable: false, width: "40px" },
  { title: "Agent", key: "name" },
  { title: "Reputation", key: "reputationScore", width: "100px" },
  { title: "Client Diversity", key: "clientDiversity", width: "120px" },
  { title: "Feedback", key: "value", width: "90px" },
];
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
      <!-- Row 1: Heuristics + Registrations chart -->
      <v-row dense>
        <v-col cols="12" md="5">
          <v-card border class="fill-height">
            <v-card-title>
              Heuristics
              <span class="heuristic-hint">24h / 7d / 30d</span>
            </v-card-title>
            <v-card-text>
              <div v-for="row in windowedHeuristicRows" :key="row.label" class="heuristic-row">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
              <div v-for="row in pointHeuristicRows" :key="row.label" class="heuristic-row">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="7">
          <LineSeriesChart title="Agent Registrations" :points="state.data.value?.charts.registrations ?? []" :state="registrationsState.state" />
        </v-col>
      </v-row>

      <!-- Row 2: 3 primary charts -->
      <v-row dense class="mt-2">
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

      <!-- Row 3: Tag Treemap -->
      <v-row dense class="mt-2">
        <v-col cols="12">
          <TagTreemap :data="state.data.value?.charts.tagHeatmap ?? []" />
        </v-col>
      </v-row>

      <!-- Row 4: Top Agents tables -->
      <v-row dense class="mt-2">
        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>Top Agents By Feedback</v-card-title>
            <v-data-table
              :headers="topAgentHeaders"
              :items="topAgents.slice(0, 10)"
              :items-per-page="-1"
              density="comfortable"
              hide-default-footer
            >
              <template #item.image="{ item }">
                <v-avatar size="28" class="my-1">
                  <v-img v-if="agentImage(item)" :src="agentImage(item)!" />
                  <v-icon v-else size="20">mdi-robot</v-icon>
                </v-avatar>
              </template>
              <template #item.name="{ item }">
                <a :href="`/agents/${item.agentId}`" class="agent-link">{{ agentName(item) }}</a>
              </template>
              <template #item.reputationScore="{ item }">
                <template v-if="item.reputationScore !== null">{{ formatNumber(item.reputationScore) }}</template>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.clientDiversity="{ item }">
                <template v-if="item.clientDiversity !== null">{{ formatPercent(item.clientDiversity) }}</template>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.value="{ item }">{{ formatNumber(item.value) }}</template>
            </v-data-table>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>Top Agents By Reputation</v-card-title>
            <v-data-table
              :headers="topAgentHeaders"
              :items="topAgentsByReputation"
              :items-per-page="-1"
              density="comfortable"
              hide-default-footer
            >
              <template #item.image="{ item }">
                <v-avatar size="28" class="my-1">
                  <v-img v-if="agentImage(item)" :src="agentImage(item)!" />
                  <v-icon v-else size="20">mdi-robot</v-icon>
                </v-avatar>
              </template>
              <template #item.name="{ item }">
                <a :href="`/agents/${item.agentId}`" class="agent-link">{{ agentName(item) }}</a>
              </template>
              <template #item.reputationScore="{ item }">
                <template v-if="item.reputationScore !== null">{{ formatNumber(item.reputationScore) }}</template>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.clientDiversity="{ item }">
                <template v-if="item.clientDiversity !== null">{{ formatPercent(item.clientDiversity) }}</template>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.value="{ item }">{{ formatNumber(item.value) }}</template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>

      <!-- Row 4: Secondary charts -->
      <v-row dense class="mt-2">
        <v-col cols="12" md="4">
          <LineSeriesChart title="Active Agents (30d)" :points="state.data.value?.charts.activeAgents ?? []" :state="activeAgentsState.state" color="#1d4ed8" />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Client Growth" :points="state.data.value?.charts.clientGrowth ?? []" :state="clientGrowthState.state" color="#0b5e67" />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart title="Responder Growth" :points="state.data.value?.charts.responderGrowth ?? []" :state="responderGrowthState.state" color="#065f46" />
        </v-col>
      </v-row>

      <!-- Row 6: Time to First Feedback -->
      <v-row dense class="mt-2">
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
.heuristic-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
  gap: 1rem;
}

.heuristic-hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-left: 0.5rem;
}

.agent-link {
  color: var(--color-link);
  text-decoration: none;
}

.agent-link:hover {
  text-decoration: underline;
}
</style>
