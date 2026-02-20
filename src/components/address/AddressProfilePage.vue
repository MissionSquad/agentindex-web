<script setup lang="ts">
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import MetricTile from "../shared/MetricTile.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { loadAddressProfileForRoute } from "../../lib/route-loaders";
import { useAsyncView } from "../../lib/view-state";
import type { AddressProfileResponse } from "../../types/api";

const props = defineProps<{
  address: string;
}>();

const api = ScannerApiClient.fromEnv();

const state = useAsyncView<AddressProfileResponse>(
  () => loadAddressProfileForRoute(api, props.address),
  (payload) =>
    payload.owner.agentsCurrentlyOwned.length === 0 &&
    payload.feedbackClient.feedback.items.length === 0 &&
    payload.responder.responses.items.length === 0,
);

const feedbackHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Agent", key: "agentId" },
  { title: "Value", key: "normalizedValue" },
  { title: "Tag1", key: "tag1" },
  { title: "Tag2", key: "tag2" },
  { title: "Endpoint", key: "endpoint" },
  { title: "Integrity", key: "integrity" },
  { title: "Tx", key: "txHash" },
];

const responseHeaders = [
  { title: "Timestamp", key: "timestamp" },
  { title: "Agent", key: "agentId" },
  { title: "Client", key: "clientAddress" },
  { title: "Feedback Index", key: "feedbackIndex" },
  { title: "Response URI", key: "responseUri" },
  { title: "Tx", key: "txHash" },
];
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No address activity"
      empty-description="This wallet has no indexed activity yet."
      @retry="state.refresh"
    >
      <v-card border class="mb-3">
        <v-card-title>Address Profile: {{ formatAddress(state.data.value?.address) }}</v-card-title>
        <v-card-subtitle>Full: {{ state.data.value?.address }} <CopyButton v-if="state.data.value?.address" :value="state.data.value.address" /></v-card-subtitle>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="4">
              <MetricTile label="Avg Score Given" :value="formatNumber(state.data.value?.feedbackClient.averageScoreGiven)" />
            </v-col>
            <v-col cols="12" md="4">
              <MetricTile label="Feedback Integrity" :value="formatPercent(state.data.value?.feedbackClient.feedbackIntegrityRate)" />
            </v-col>
            <v-col cols="12" md="4">
              <MetricTile
                label="Avg Response Latency"
                :value="formatNumber(state.data.value?.responder.averageResponseLatencyHours)"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-row dense>
        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>As Owner</v-card-title>
            <v-card-text>
              <p>
                <strong>Agents currently owned:</strong>
                <template v-if="(state.data.value?.owner.agentsCurrentlyOwned ?? []).length > 0">
                  <a v-for="agentId in state.data.value?.owner.agentsCurrentlyOwned" :key="agentId" :href="`/agents/${agentId}`" class="agent-chip">{{ agentId }}</a>
                </template>
                <span v-else>None</span>
              </p>
              <p>
                <strong>Originally registered:</strong>
                <template v-if="(state.data.value?.owner.agentsOriginallyRegistered ?? []).length > 0">
                  <a v-for="agentId in state.data.value?.owner.agentsOriginallyRegistered" :key="agentId" :href="`/agents/${agentId}`" class="agent-chip">{{ agentId }}</a>
                </template>
                <span v-else>None</span>
              </p>
              <p>
                <strong>Transferred away:</strong>
                <template v-if="(state.data.value?.owner.agentsTransferredAway ?? []).length > 0">
                  <a v-for="agentId in state.data.value?.owner.agentsTransferredAway" :key="agentId" :href="`/agents/${agentId}`" class="agent-chip">{{ agentId }}</a>
                </template>
                <span v-else>None</span>
              </p>
              <p>
                <strong>Received via transfer:</strong>
                <template v-if="(state.data.value?.owner.agentsReceivedViaTransfer ?? []).length > 0">
                  <a v-for="agentId in state.data.value?.owner.agentsReceivedViaTransfer" :key="agentId" :href="`/agents/${agentId}`" class="agent-chip">{{ agentId }}</a>
                </template>
                <span v-else>None</span>
              </p>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card border>
            <v-card-title>As Payout Wallet</v-card-title>
            <v-card-text>
              <p v-if="(state.data.value?.payoutWalletAgentIds ?? []).length > 0">
                Linked agents:
                <a v-for="agentId in state.data.value?.payoutWalletAgentIds" :key="agentId" :href="`/agents/${agentId}`" class="agent-chip">{{ agentId }}</a>
              </p>
              <p v-else>No agentWallet linkage found</p>
            </v-card-text>
          </v-card>

          <v-card border class="mt-3">
            <v-card-title>As URI Updater</v-card-title>
            <v-card-text>
              URI updates performed: {{ formatNumber(state.data.value?.uriUpdateCount) }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-card border class="mt-3">
        <v-card-title>As Feedback Client</v-card-title>
        <v-data-table :headers="feedbackHeaders" :items="state.data.value?.feedbackClient.feedback.items ?? []">
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ item.agentId }}</a></template>
          <template #item.normalizedValue="{ item }">{{ formatNumber(item.normalizedValue) }}</template>
          <template #item.integrity="{ item }">{{ item.integrity }}</template>
          <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
        </v-data-table>
      </v-card>

      <v-card border class="mt-3">
        <v-card-title>As Responder</v-card-title>
        <v-data-table :headers="responseHeaders" :items="state.data.value?.responder.responses.items ?? []">
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ item.agentId }}</a></template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.responseUri="{ item }">
            <a v-if="item.responseUri" :href="item.responseUri" target="_blank" rel="noreferrer">open</a>
            <CopyButton v-if="item.responseUri" :value="item.responseUri" />
            <span v-if="!item.responseUri">N/A</span>
          </template>
          <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
        </v-data-table>
      </v-card>
    </AsyncStateGate>
  </section>
</template>

<style scoped>
.agent-chip {
  display: inline-block;
  margin: 0.15rem 0.25rem;
  padding: 0.1rem 0.5rem;
  border-radius: 12px;
  background: var(--color-chip-green-bg);
  font-size: 0.85rem;
  text-decoration: none;
}

.agent-chip:hover {
  background: var(--color-chip-green-hover);
}
</style>
