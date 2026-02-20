<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatNumber, formatTimestamp } from "../../lib/formatters";
import { useAsyncView } from "../../lib/view-state";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import { extractAgentUriMetadata } from "../../lib/uri-metadata";
import type { AgentSort, PaginatedResult, AgentSummary } from "../../types/api";

const api = ScannerApiClient.fromEnv();

const filters = reactive<{
  page: number;
  limit: number;
  sort: AgentSort;
  hasFeedback: "all" | "yes" | "no";
  days: number;
  tag: string;
  x402Support: "all" | "yes" | "no";
  protocol: "all" | "a2a" | "mcp" | "oasf" | "web";
  hasBeenTransferred: "all" | "yes" | "no";
  hasResponses: "all" | "yes" | "no";
}>({
  page: 1,
  limit: 25,
  sort: "newest",
  hasFeedback: "all",
  days: 30,
  tag: "",
  x402Support: "all",
  protocol: "all",
  hasBeenTransferred: "all",
  hasResponses: "all",
});

const headers = [
  { title: "Agent ID", key: "agentId" },
  { title: "Name", key: "name" },
  { title: "Owner", key: "ownerAddress" },
  { title: "Registrant", key: "originalRegistrant" },
  { title: "Feedback", key: "feedbackCount" },
  { title: "Avg Reputation", key: "averageReputation" },
  { title: "Registered", key: "registrationTimestamp" },
  { title: "Transferred", key: "hasBeenTransferred" },
];

function mapToggle(value: "all" | "yes" | "no"): boolean | undefined {
  if (value === "all") {
    return undefined;
  }

  return value === "yes";
}

const state = useAsyncView<PaginatedResult<AgentSummary>>(
  () =>
    api.getAgents({
      page: filters.page,
      limit: filters.limit,
      sort: filters.sort,
      hasFeedback: mapToggle(filters.hasFeedback),
      registeredSinceDays: filters.days,
      tag: filters.tag || undefined,
      x402Support: mapToggle(filters.x402Support),
      protocol: filters.protocol === "all" ? undefined : filters.protocol,
      hasBeenTransferred: mapToggle(filters.hasBeenTransferred),
      hasResponses: mapToggle(filters.hasResponses),
    }),
  (payload) => payload.items.length === 0,
  false,
);

const totalPages = computed(() => {
  const data = state.data.value;
  if (!data) {
    return 1;
  }

  const { total, limit } = data.meta;
  return Math.max(1, Math.ceil(total / Math.max(limit, 1)));
});

watch(
  () => [
    filters.page,
    filters.limit,
    filters.sort,
    filters.hasFeedback,
    filters.days,
    filters.tag,
    filters.x402Support,
    filters.protocol,
    filters.hasBeenTransferred,
    filters.hasResponses,
  ],
  () => {
    void state.refresh();
  },
);

onMounted(() => {
  void state.refresh();
});

// Resolve agent URIs for each agent to extract JSON-derived names
const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);
const agentNameMap = ref(new Map<string, string>());

watch(
  () => state.data.value?.items,
  async (agents) => {
    if (!agents || agents.length === 0) return;

    const map = new Map<string, string>();

    await Promise.all(
      agents.map(async (agent) => {
        if (!agent.agentUri) {
          map.set(agent.agentId, agent.name);
          return;
        }

        let resolved = resolveAgentUri(agent.agentUri);

        if (needsAsyncDataResolve(resolved)) {
          try {
            resolved = await resolveDataUriAsync(agent.agentUri);
          } catch {
            // fallback
          }
        }

        if (FETCHABLE_SCHEMES.has(resolved.scheme) && resolved.decoded === null) {
          try {
            const fetched = await api.resolveUri(resolved.raw);
            if (fetched.contentType === "application/json" && fetched.body !== null) {
              resolved = { scheme: resolved.scheme, raw: resolved.raw, decoded: fetched.body, error: null };
            }
          } catch {
            // fallback
          }
        }

        const metadata = extractAgentUriMetadata(resolved.decoded);
        map.set(agent.agentId, metadata.name ?? agent.name);
      }),
    );

    agentNameMap.value = map;
  },
  { immediate: true },
);

function resolvedAgentName(agent: AgentSummary): string {
  return agentNameMap.value.get(agent.agentId) ?? agent.name;
}
</script>

<template>
  <section>
    <v-card border class="mb-4">
      <v-card-title>Agent Filters</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.sort"
              :items="[
                { title: 'Newest', value: 'newest' },
                { title: 'Oldest', value: 'oldest' },
                { title: 'Most Feedback', value: 'most-feedback' },
                { title: 'Highest Reputation', value: 'highest-reputation' },
                { title: 'Most Recently Active', value: 'recently-active' },
              ]"
              label="Sort"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.hasFeedback"
              :items="[
                { title: 'All', value: 'all' },
                { title: 'Has Feedback', value: 'yes' },
                { title: 'No Feedback', value: 'no' },
              ]"
              label="Has Feedback"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model.number="filters.days" type="number" min="1" label="Registered in Last N Days" />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="filters.tag" label="Tag (tag1/tag2)" />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.x402Support"
              :items="[
                { title: 'x402 Any', value: 'all' },
                { title: 'x402 Enabled', value: 'yes' },
                { title: 'x402 Disabled', value: 'no' },
              ]"
              label="x402"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.protocol"
              :items="[
                { title: 'Any Protocol', value: 'all' },
                { title: 'A2A', value: 'a2a' },
                { title: 'MCP', value: 'mcp' },
                { title: 'OASF', value: 'oasf' },
                { title: 'Web', value: 'web' },
              ]"
              label="Protocol"
            />
          </v-col>
        </v-row>

        <v-row dense>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.hasBeenTransferred"
              :items="[
                { title: 'Transfer Any', value: 'all' },
                { title: 'Transferred', value: 'yes' },
                { title: 'Never Transferred', value: 'no' },
              ]"
              label="Transfer Status"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.hasResponses"
              :items="[
                { title: 'Response Any', value: 'all' },
                { title: 'Has Responses', value: 'yes' },
                { title: 'No Responses', value: 'no' },
              ]"
              label="Response Status"
            />
          </v-col>
          <v-col cols="12" md="3" offset-md="3" class="d-flex align-center justify-end">
            <v-btn color="primary" @click="filters.page = 1">Apply Filters</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No agents"
      empty-description="No agents matched the current filter set."
      @retry="state.refresh"
    >
      <v-card border>
        <v-data-table
          :headers="headers"
          :items="state.data.value?.items ?? []"
          :items-per-page="-1"
          density="comfortable"
          hide-default-footer
        >
          <template #item.name="{ item }">
            <a :href="`/agents/${item.agentId}`" class="agent-link">{{ resolvedAgentName(item) }}</a>
          </template>

          <template #item.ownerAddress="{ item }">
            <a :href="`/address/${item.ownerAddress}`">{{ formatAddress(item.ownerAddress) }}</a>
            <CopyButton :value="item.ownerAddress" />
          </template>

          <template #item.originalRegistrant="{ item }">
            <a :href="`/address/${item.originalRegistrant}`">{{ formatAddress(item.originalRegistrant) }}</a>
            <CopyButton :value="item.originalRegistrant" />
          </template>

          <template #item.feedbackCount="{ item }">{{ formatNumber(item.feedbackCount) }}</template>
          <template #item.averageReputation="{ item }">{{ formatNumber(item.averageReputation) }}</template>
          <template #item.registrationTimestamp="{ item }">{{ formatTimestamp(item.registrationTimestamp) }}</template>
          <template #item.hasBeenTransferred="{ item }">
            <v-chip :color="item.hasBeenTransferred ? 'warning' : 'success'" size="small">
              {{ item.hasBeenTransferred ? "Yes" : "No" }}
            </v-chip>
          </template>
        </v-data-table>

        <v-divider />

        <v-card-actions class="justify-space-between align-center">
          <p class="text-caption mb-0">Total agents: {{ formatNumber(state.data.value?.meta.total) }}</p>
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
</style>
