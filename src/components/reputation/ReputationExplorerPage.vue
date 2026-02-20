<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import MetricTile from "../shared/MetricTile.vue";
import UriOverlay from "../shared/UriOverlay.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { useAsyncView } from "../../lib/view-state";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import { extractAgentUriMetadata } from "../../lib/uri-metadata";
import type { ReputationResponse, ResponseEntry } from "../../types/api";

const api = ScannerApiClient.fromEnv();
const uriOverlay = ref<InstanceType<typeof UriOverlay> | null>(null);
const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);

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

// Resolve agent URIs to get JSON-derived names for the Agent column
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
  async (data) => {
    if (!data) return;

    const agentIds = new Set<string>();
    data.recentResponses.items.forEach((item) => agentIds.add(item.agentId));
    data.recentFeedback.items.forEach((item) => agentIds.add(item.agentId));

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

function displayAgentName(agentId: string): string {
  return agentNameMap.value.get(agentId) ?? agentId;
}

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
  { title: "Responder", key: "responder" },
  { title: "Response", key: "responseUri" },
  { title: "Tx", key: "txHash" },
];

// Resolve response URIs to extract the "response" field value
const responseValueMap = ref(new Map<string, string>());

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractResponseField(decoded: unknown): string | null {
  if (!isRecord(decoded)) return null;
  const response = decoded.response;
  return typeof response === "string" && response.length > 0 ? response : null;
}

watch(
  () => state.data.value?.recentResponses.items,
  async (responses) => {
    if (!responses || responses.length === 0) return;

    const map = new Map<string, string>();

    await Promise.all(
      responses.map(async (entry) => {
        if (!entry.responseUri) return;

        const key = `${entry.responseId}`;
        let resolved = resolveAgentUri(entry.responseUri);

        if (needsAsyncDataResolve(resolved)) {
          try {
            resolved = await resolveDataUriAsync(entry.responseUri);
          } catch {
            return;
          }
        }

        if (FETCHABLE_SCHEMES.has(resolved.scheme) && resolved.decoded === null && !resolved.error) {
          try {
            const fetched = await api.resolveUri(resolved.raw);
            if (fetched.contentType === "application/json" && fetched.body !== null) {
              resolved = { scheme: resolved.scheme, raw: resolved.raw, decoded: fetched.body, error: null };
            }
          } catch {
            return;
          }
        }

        const responseText = extractResponseField(resolved.decoded);
        if (responseText) {
          map.set(key, responseText);
        }
      }),
    );

    responseValueMap.value = map;
  },
  { immediate: true },
);

function resolvedResponseText(entry: ResponseEntry): string | null {
  return responseValueMap.value.get(`${entry.responseId}`) ?? null;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
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
        <v-card-title>Recent Responses</v-card-title>
        <v-data-table
          :headers="responseHeaders"
          :items="state.data.value?.recentResponses.items ?? []"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
        >
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ displayAgentName(item.agentId) }}</a></template>
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
              <span class="response-text">{{ resolvedResponseText(item) ? truncateText(resolvedResponseText(item)!, 20) : "..." }}</span>
              <v-btn
                icon="mdi-dock-window"
                variant="text"
                size="x-small"
                density="compact"
                class="overlay-btn"
                @click="uriOverlay?.open(item.responseUri)"
              />
            </template>
            <span v-else>-</span>
          </template>
          <template #item.txHash="{ item }">
            <a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a>
            <CopyButton :value="item.txHash" />
          </template>
        </v-data-table>
      </v-card>

      <v-card border>
        <v-card-title>Recent Feedback</v-card-title>
        <v-data-table
          :headers="feedbackHeaders"
          :items="state.data.value?.recentFeedback.items ?? []"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
        >
          <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
          <template #item.agentId="{ item }"><a :href="`/agents/${item.agentId}`">{{ displayAgentName(item.agentId) }}</a></template>
          <template #item.clientAddress="{ item }">
            <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
            <CopyButton :value="item.clientAddress" />
          </template>
          <template #item.normalizedValue="{ item }">{{ formatNumber(item.normalizedValue) }}</template>
          <template #item.revoked="{ item }">{{ item.revoked ? "Yes" : "No" }}</template>
          <template #item.txHash="{ item }">
            <a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a>
            <CopyButton :value="item.txHash" />
          </template>
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
            <v-pagination v-model="filters.page" :length="totalPages" :total-visible="5" density="compact" />
          </div>
        </v-card-actions>
      </v-card>
    </AsyncStateGate>

    <UriOverlay ref="uriOverlay" />
  </section>
</template>

<style scoped>
.response-text {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.overlay-btn {
  opacity: 0.45;
  transition: opacity 0.15s ease;
  margin-left: 4px;
  vertical-align: middle;
  position: relative;
  top: -2px;
  flex-shrink: 0;
}

.overlay-btn:hover {
  opacity: 1;
}
</style>
