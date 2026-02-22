<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import MetricTile from "../shared/MetricTile.vue";
import LineSeriesChart from "../shared/LineSeriesChart.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { createDashboardActivityStreamClient } from "../../lib/dashboard-activity-stream";
import { formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { resolveChartState } from "../../lib/chart-state";
import type { ChartStateContext } from "../../lib/chart-state";
import { useAsyncView } from "../../lib/view-state";
import type { AnalyticsOverviewResponse, DashboardActivityItem, TimeSeriesPoint, TopAgentSummary } from "../../types/api";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function lastThreeDays(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
  const cutoff = Date.now() - THREE_DAYS_MS;
  return points.filter((p) => p.timestamp >= cutoff);
}

const api = ScannerApiClient.fromEnv();

const viewportWidth = ref(1440);

const readViewport = (): void => {
  viewportWidth.value = window.innerWidth;
};

onMounted(() => {
  readViewport();
  window.addEventListener("resize", readViewport);
  activityFeedStream.start();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", readViewport);
  activityFeedStream.stop();
});

const state = useAsyncView<AnalyticsOverviewResponse>(
  () => api.getAnalyticsOverview(),
  (payload) => payload.activityFeed.length === 0 && payload.dashboardMetrics.totalRegisteredAgents === 0,
);

function mergeActivityFeedItems(
  existing: DashboardActivityItem[],
  incoming: DashboardActivityItem,
): DashboardActivityItem[] {
  const dedupedExisting = existing.filter((item) =>
    !(item.chainId === incoming.chainId && item.txHash === incoming.txHash && item.logIndex === incoming.logIndex),
  );
  return [incoming, ...dedupedExisting];
}

const activityFeedStream = createDashboardActivityStreamClient({
  onActivity: (incomingItem) => {
    const current = state.data.value;
    if (!current) return;

    state.data.value = {
      ...current,
      activityFeed: mergeActivityFeedItems(current.activityFeed, incomingItem),
    };
  },
});

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
const transferVolumeState = computed(() =>
  resolveChartState("transferVolume", state.data.value?.charts.transferVolume ?? [], chartCtx.value),
);

const metricTiles = computed(() => {
  const data = state.data.value;
  if (!data) {
    return [];
  }

  return [
    { label: "Registered Agents", value: formatNumber(data.dashboardMetrics.totalRegisteredAgents) },
    {
      label: "New Agents",
      value: `${formatNumber(data.dashboardMetrics.newAgents24h)} / ${formatNumber(
        data.dashboardMetrics.newAgents7d,
      )} / ${formatNumber(data.dashboardMetrics.newAgents30d)}`,
      hint: "24h / 7d / 30d",
    },
    { label: "Total Feedback", value: formatNumber(data.dashboardMetrics.totalFeedbackSubmitted) },
    { label: "Unique Clients", value: formatNumber(data.dashboardMetrics.uniqueClientAddresses) },
    { label: "Responses", value: formatNumber(data.dashboardMetrics.totalResponsesAppended) },
    { label: "Transfers", value: formatNumber(data.dashboardMetrics.agentTransfers) },
  ];
});

const topAgents = computed(() => state.data.value?.charts.topAgentsByFeedback ?? []);

const topAgentsByReputation = computed(() => {
  const agents = state.data.value?.charts.topAgentsByFeedback ?? [];
  return [...agents]
    .filter((a) => a.reputationScore !== null)
    .sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0))
    .slice(0, 10);
});
const activityFeed = computed(() => state.data.value?.activityFeed ?? []);
const failedImageUrls = ref<Set<string>>(new Set());

function markImageUrlAsFailed(url: string): void {
  const normalized = url.trim();
  if (normalized.length === 0 || failedImageUrls.value.has(normalized)) {
    return;
  }

  const next = new Set(failedImageUrls.value);
  next.add(normalized);
  failedImageUrls.value = next;
}

function onImageLoadError(failedUrl: string | undefined): void {
  if (!failedUrl) return;
  markImageUrlAsFailed(failedUrl);
}

function toDisplayImageUrl(raw: string): string | null {
  const resolved = raw.startsWith("data:") ? raw : api.imageProxyUrl(raw);
  if (!resolved || failedImageUrls.value.has(resolved)) {
    return null;
  }
  return resolved;
}

function agentName(agent: TopAgentSummary): string {
  return agent.name ?? `Agent ${agent.agentId}`;
}

function agentImage(agent: TopAgentSummary): string | null {
  if (!agent.imageUrl) return null;
  return toDisplayImageUrl(agent.imageUrl);
}

function activityAgentDisplayName(item: DashboardActivityItem): string | null {
  const name = item.agentName?.trim();
  if (name && name.length > 0) return name;
  if (item.agentId) return `Agent ${item.agentId}`;
  return null;
}

function activityAgentImage(item: DashboardActivityItem): string | null {
  if (!item.agentImageUrl) return null;
  return toDisplayImageUrl(item.agentImageUrl);
}

function hasActivityAgent(item: DashboardActivityItem): boolean {
  return activityAgentDisplayName(item) !== null;
}

const topAgentHeaders = [
  { title: "", key: "image", sortable: false, width: "40px" },
  { title: "Agent", key: "name" },
  { title: "Reputation", key: "reputationScore", width: "100px" },
  { title: "Client Diversity", key: "clientDiversity", width: "120px" },
  { title: "Feedback", key: "value", width: "90px" },
];

interface SummarySegment {
  type: "text" | "address";
  value: string;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function hasSummary(text: string): boolean {
  return text.trim().length > 0;
}

function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS;
}

function formatActivityAddress(address: string): string {
  const normalized = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

function parseSummary(text: string): SummarySegment[] {
  const segments: SummarySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(/0x[a-fA-F0-9]{40}/g)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, idx) });
    }
    segments.push({ type: "address", value: match[0] });
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No dashboard data"
      empty-description="Analytics data has not been materialized yet."
      @retry="state.refresh"
    >
      <v-row dense>
        <v-col
          v-for="tile in metricTiles"
          :key="tile.label"
          cols="6"
          md="4"
          lg="2"
        >
          <MetricTile :label="tile.label" :value="tile.value" :hint="tile.hint" />
        </v-col>
      </v-row>

      <v-row class="mt-2" dense>
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
                  <v-img v-if="agentImage(item)" :src="agentImage(item)!" @error="onImageLoadError" />
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
                  <v-img v-if="agentImage(item)" :src="agentImage(item)!" @error="onImageLoadError" />
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

      <v-row class="mt-2" dense>
        <v-col cols="12">
          <v-card border>
            <v-card-title>Live Activity Feed</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <TransitionGroup name="activity-feed" tag="div">
                  <v-list-item
                    v-for="item in activityFeed"
                    :key="`${item.chainId}:${item.txHash}:${item.logIndex}`"
                    class="activity-feed-item"
                  >
                    <div class="activity-feed-line">
                      <span class="activity-event-name">{{ item.eventName }}</span>
                      <template v-if="hasActivityAgent(item)">
                        <span class="activity-separator">·</span>
                        <span class="activity-agent">
                          <v-avatar size="18" class="activity-agent-avatar">
                            <v-img
                              v-if="activityAgentImage(item)"
                              :src="activityAgentImage(item)!"
                              @error="onImageLoadError"
                            />
                            <v-icon v-else size="13">mdi-robot</v-icon>
                          </v-avatar>
                          <a v-if="item.agentId" :href="`/agents/${item.agentId}`" class="activity-agent-link">
                            {{ activityAgentDisplayName(item) }}
                          </a>
                          <span v-else class="activity-agent-label">{{ activityAgentDisplayName(item) }}</span>
                        </span>
                      </template>
                      <template v-if="hasSummary(item.summary)">
                        <span class="activity-separator">·</span>
                        <span class="activity-summary">
                          <template v-for="(seg, i) in parseSummary(item.summary)" :key="i">
                            <a
                              v-if="seg.type === 'address' && !isZeroAddress(seg.value)"
                              :href="`/address/${seg.value.toLowerCase()}`"
                            >
                              {{ formatActivityAddress(seg.value) }}
                            </a>
                            <span v-else-if="seg.type === 'address'">{{ formatActivityAddress(seg.value) }}</span>
                            <span v-else>{{ seg.value }}</span>
                          </template>
                        </span>
                      </template>
                      <span class="activity-separator">·</span>
                      <span>{{ formatTimestamp(item.timestamp) }}</span>
                      <span class="activity-separator">·</span>
                      <a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a>
                      <CopyButton :value="item.txHash" />
                    </div>
                  </v-list-item>
                </TransitionGroup>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-2" dense>
        <v-col cols="12" md="4">
          <LineSeriesChart
            title="Agent Registrations"
            :points="lastThreeDays(state.data.value?.charts.registrations ?? [])"
            :state="registrationsState.state"
            color="#0b5e67"
          />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart
            title="Feedback Submissions"
            :points="lastThreeDays(state.data.value?.charts.feedbackVolume ?? [])"
            :state="feedbackVolumeState.state"
            color="#ff7a45"
          />
        </v-col>
        <v-col cols="12" md="4">
          <LineSeriesChart
            title="Ownership Transfers"
            :points="lastThreeDays(state.data.value?.charts.transferVolume ?? [])"
            :state="transferVolumeState.state"
            color="#1d4ed8"
          />
        </v-col>
      </v-row>
    </AsyncStateGate>
  </section>
</template>

<style scoped>
.agent-link {
  color: var(--color-link);
  text-decoration: none;
}

.agent-link:hover {
  text-decoration: underline;
}

.activity-feed-item {
  min-height: 36px;
}

.activity-feed-item + .activity-feed-item {
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.activity-feed-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  line-height: 1.35;
}

.activity-event-name {
  font-weight: 600;
}

.activity-agent {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.activity-agent-label {
  font-weight: 500;
}

.activity-separator {
  opacity: 0.65;
}

.activity-summary {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.1rem;
}

.activity-feed-line a {
  color: var(--color-link);
  text-decoration: none;
}

.activity-feed-line a:hover {
  text-decoration: underline;
}

.activity-feed-enter-active {
  transition: transform 240ms ease, opacity 240ms ease;
}

.activity-feed-enter-from {
  transform: translateY(-12px);
  opacity: 0;
}

.activity-feed-move {
  transition: transform 240ms ease;
}
</style>
