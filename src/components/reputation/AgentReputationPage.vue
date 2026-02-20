<script setup lang="ts">
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import MetricTile from "../shared/MetricTile.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { loadAgentReputationForRoute } from "../../lib/route-loaders";
import { useAsyncView } from "../../lib/view-state";
import type { ReputationResponse } from "../../types/api";

const props = defineProps<{
  agentId: string;
}>();

const api = ScannerApiClient.fromEnv();

const state = useAsyncView<ReputationResponse>(
  () => loadAgentReputationForRoute(api, props.agentId),
  (payload) => payload.recentFeedback.items.length === 0,
);

const feedbackHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Client", key: "clientAddress" },
  { title: "Value", key: "normalizedValue" },
  { title: "Tag1", key: "tag1" },
  { title: "Tag2", key: "tag2" },
  { title: "Endpoint", key: "endpoint" },
  { title: "Revoked", key: "revoked" },
  { title: "Tx", key: "txHash" },
];

const responseHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Client", key: "clientAddress" },
  { title: "Feedback Index", key: "feedbackIndex" },
  { title: "Responder", key: "responder" },
  { title: "Response URI", key: "responseUri" },
  { title: "Tx", key: "txHash" },
];
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No reputation rows"
      empty-description="No feedback exists for this agent yet."
      @retry="state.refresh"
    >
      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <MetricTile label="Total Feedback" :value="formatNumber(state.data.value?.metrics.totalFeedbackEntries)" />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile label="Total Responses" :value="formatNumber(state.data.value?.metrics.totalResponsesAppended)" />
        </v-col>
        <v-col cols="12" md="4">
          <MetricTile label="Integrity Failure Rate" :value="formatPercent(state.data.value?.heuristics.integrityFailureRate)" />
        </v-col>
      </v-row>

      <v-card border class="mb-3">
        <v-card-title>Agent Feedback</v-card-title>
        <v-data-table :headers="feedbackHeaders" :items="state.data.value?.recentFeedback.items ?? []">
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.normalizedValue="{ item }">{{ formatNumber(item.normalizedValue) }}</template>
          <template #item.revoked="{ item }">{{ item.revoked ? "Yes" : "No" }}</template>
          <template #item.txHash="{ item }">{{ formatTxHash(item.txHash) }} <CopyButton :value="item.txHash" /></template>
        </v-data-table>
      </v-card>

      <v-card border>
        <v-card-title>Agent Responses</v-card-title>
        <v-data-table :headers="responseHeaders" :items="state.data.value?.recentResponses.items ?? []">
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.responder="{ item }">
            <a :href="`/address/${item.responder}`">{{ formatAddress(item.responder) }}</a>
            <CopyButton :value="item.responder" />
          </template>
          <template #item.responseUri="{ item }">
            <a v-if="item.responseUri" :href="item.responseUri" target="_blank" rel="noreferrer">open</a>
            <CopyButton v-if="item.responseUri" :value="item.responseUri" />
            <span v-if="!item.responseUri">N/A</span>
          </template>
          <template #item.txHash="{ item }">{{ formatTxHash(item.txHash) }} <CopyButton :value="item.txHash" /></template>
        </v-data-table>
      </v-card>
    </AsyncStateGate>
  </section>
</template>
