<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import MetricTile from "../shared/MetricTile.vue";
import UriOverlay from "../shared/UriOverlay.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { useAsyncView } from "../../lib/view-state";
import type { ReputationResponse } from "../../types/api";

const api = ScannerApiClient.fromEnv();
const uriOverlay = ref<InstanceType<typeof UriOverlay> | null>(null);

const filters = reactive({
  page: 1,
  limit: 25,
  tag: "",
  endpoint: "",
});

const state = useAsyncView<ReputationResponse>(
  () =>
    api.getReputation({
      page: filters.page,
      limit: filters.limit,
      tag: filters.tag || undefined,
      endpoint: filters.endpoint || undefined,
    }),
  (payload) => payload.recentFeedback.items.length === 0 && payload.recentResponses.items.length === 0,
  false,
);

const totalPages = computed(() => {
  const meta = state.data.value?.recentFeedback.meta;
  if (!meta) {
    return 1;
  }

  return Math.max(1, Math.ceil(meta.total / Math.max(meta.limit, 1)));
});

watch(
  () => [filters.page, filters.limit, filters.tag, filters.endpoint],
  () => {
    void state.refresh();
  },
);

onMounted(() => {
  void state.refresh();
});

const feedbackHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Agent", key: "agentId" },
  { title: "Client", key: "clientAddress" },
  { title: "Value", key: "normalizedValue" },
  { title: "Tag 1", key: "tag1" },
  { title: "Tag 2", key: "tag2" },
  { title: "Endpoint", key: "endpoint" },
  { title: "Revoked", key: "revoked" },
  { title: "Tx", key: "txHash" },
];

const responseHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Agent", key: "agentId" },
  { title: "Client", key: "clientAddress" },
  { title: "Feedback Index", key: "feedbackIndex" },
  { title: "Responder", key: "responder" },
  { title: "Response URI", key: "responseUri" },
  { title: "Tx", key: "txHash" },
];
</script>

<template>
  <section>
    <v-card border class="mb-4">
      <v-card-title>Reputation Filters</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field v-model="filters.tag" label="Tag" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="filters.endpoint" label="Endpoint" />
          </v-col>
          <v-col cols="12" md="4" class="d-flex justify-end align-center">
            <v-btn color="primary" @click="filters.page = 1">Apply</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No reputation rows"
      empty-description="No feedback or response activity matched the filters."
      @retry="state.refresh"
    >
      <v-row dense class="mb-2">
        <v-col cols="12" md="3">
          <MetricTile label="Total Feedback" :value="formatNumber(state.data.value?.metrics.totalFeedbackEntries)" />
        </v-col>
        <v-col cols="12" md="3">
          <MetricTile label="Total Revocations" :value="formatNumber(state.data.value?.metrics.totalRevocations)" />
        </v-col>
        <v-col cols="12" md="3">
          <MetricTile label="Total Responses" :value="formatNumber(state.data.value?.metrics.totalResponsesAppended)" />
        </v-col>
        <v-col cols="12" md="3">
          <MetricTile label="Unique Clients" :value="formatNumber(state.data.value?.metrics.uniqueClients)" />
        </v-col>
      </v-row>

      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <MetricTile
            label="Feedback Velocity"
            :value="formatNumber(state.data.value?.heuristics.feedbackVelocity)"
            hint="Feedback count / window"
          />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile
            label="Responder Diversity"
            :value="formatPercent(state.data.value?.heuristics.responderDiversity)"
            hint="Unique responders / total responses"
          />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile
            label="Integrity Failure Rate"
            :value="formatPercent(state.data.value?.heuristics.integrityFailureRate)"
            hint="Mismatched feedback hashes"
          />
        </v-col>
      </v-row>

      <v-card border class="mb-3">
        <v-card-title>Recent Feedback</v-card-title>
        <v-data-table
          :headers="feedbackHeaders"
          :items="state.data.value?.recentFeedback.items ?? []"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
        >
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ item.agentId }}</a></template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.normalizedValue="{ item }">{{ formatNumber(item.normalizedValue) }}</template>
          <template #item.revoked="{ item }">{{ item.revoked ? "Yes" : "No" }}</template>
          <template #item.txHash="{ item }">{{ formatTxHash(item.txHash) }} <CopyButton :value="item.txHash" /></template>
        </v-data-table>

        <v-divider />

        <v-card-actions class="justify-space-between align-center">
          <p class="text-caption mb-0">Total feedback: {{ formatNumber(state.data.value?.recentFeedback.meta.total) }}</p>
          <div class="d-flex align-center ga-3">
            <v-select
              v-model="filters.limit"
              :items="[
                { title: '10', value: 10 },
                { title: '25', value: 25 },
                { title: '50', value: 50 },
                { title: '100', value: 100 },
              ]"
              label="Rows"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 100px"
            />
            <v-pagination v-model="filters.page" :length="totalPages" total-visible="7" density="compact" />
          </div>
        </v-card-actions>
      </v-card>

      <v-card border>
        <v-card-title>Recent Responses</v-card-title>
        <v-data-table
          :headers="responseHeaders"
          :items="state.data.value?.recentResponses.items ?? []"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
        >
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ item.agentId }}</a></template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.responder="{ item }">
            <a :href="`/address/${item.responder}`">{{ formatAddress(item.responder) }}</a>
            <CopyButton :value="item.responder" />
          </template>
          <template #item.responseUri="{ item }">
            <template v-if="item.responseUri">
              <span class="uri-cell" @click="uriOverlay?.open(item.responseUri)">open</span>
              <CopyButton :value="item.responseUri" />
            </template>
            <span v-else>-</span>
          </template>
          <template #item.txHash="{ item }">{{ formatTxHash(item.txHash) }} <CopyButton :value="item.txHash" /></template>
        </v-data-table>
      </v-card>
    </AsyncStateGate>

    <UriOverlay ref="uriOverlay" />
  </section>
</template>

<style scoped>
.uri-cell {
  cursor: pointer;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-link-alt);
}

.uri-cell:hover {
  text-decoration: underline;
}
</style>
