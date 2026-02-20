<script setup lang="ts">
import { computed, ref, watch } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatKeyValueMap, formatMiddleTruncate, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { isEthereumAddress } from "../../lib/query";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import type { ResolvedUri } from "../../lib/uri-resolver";
import { extractAgentUriMetadata } from "../../lib/uri-metadata";
import { loadTransactionForRoute } from "../../lib/route-loaders";
import { useAsyncView } from "../../lib/view-state";
import type { TransactionDetailResponse } from "../../types/api";

const props = defineProps<{
  txHash: string;
}>();

const api = ScannerApiClient.fromEnv();

const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);
const URI_PREFIXES = ["data:", "http://", "https://", "ipfs://"];
const COPYABLE_ENVELOPE_KEYS = new Set(["Tx Hash", "Block Hash"]);
const TRUNCATABLE_ENVELOPE_KEYS = new Set(["Tx Hash", "Block Hash"]);

const AGENT_ID_KEYS = new Set(["agentId", "tokenId", "_tokenId"]);

function looksLikeUri(value: string): boolean {
  return URI_PREFIXES.some((p) => value.startsWith(p)) || value.startsWith("{");
}

function classifyArgValue(key: string, value: string): "agentId" | "address" | "uri" | "text" {
  if (AGENT_ID_KEYS.has(key) && /^\d+$/.test(value)) {
    return "agentId";
  }
  if (isEthereumAddress(value)) {
    return "address";
  }
  if (looksLikeUri(value)) {
    return "uri";
  }
  return "text";
}

const state = useAsyncView<TransactionDetailResponse>(
  () => loadTransactionForRoute(api, props.txHash),
  (payload) => payload.transactionFact.txHash.length === 0,
);

const envelopeRows = computed(() => {
  const tx = state.data.value?.transactionFact;
  if (!tx) {
    return [];
  }

  return [
    { key: "Tx Hash", value: tx.txHash },
    { key: "Chain ID", value: String(tx.chainId) },
    { key: "Block", value: String(tx.blockNumber) },
    { key: "Block Hash", value: tx.blockHash },
    { key: "Index", value: String(tx.transactionIndex) },
    { key: "Nonce", value: String(tx.nonce) },
    { key: "Value", value: tx.value },
    { key: "Gas", value: tx.gas },
    { key: "Gas Used", value: tx.gasUsed },
    { key: "Gas Price", value: tx.gasPrice },
    { key: "Max Fee", value: tx.maxFeePerGas ?? "N/A" },
    { key: "Max Priority Fee", value: tx.maxPriorityFeePerGas ?? "N/A" },
    { key: "Cumulative Gas Used", value: tx.cumulativeGasUsed },
  ];
});

const callArgs = computed(() => {
  const call = state.data.value?.callFact;
  if (!call) {
    return [];
  }

  return formatKeyValueMap(call.normalizedArgs);
});

const formattedEvents = computed(() => {
  const events = state.data.value?.eventFacts ?? [];
  return events.map((evt) => ({
    logIndex: evt.logIndex,
    eventName: evt.eventName || "Unknown Event",
    eventSignature: evt.eventSignature,
    args: formatKeyValueMap(evt.eventArgs),
  }));
});

// Extract unique agent IDs from call args and event args
const involvedAgentIds = computed<string[]>(() => {
  const ids = new Set<string>();
  const data = state.data.value;
  if (!data) return [];

  const scanRecord = (record: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(record)) {
      if (AGENT_ID_KEYS.has(key) && typeof value === "string" && /^\d+$/.test(value)) {
        ids.add(value);
      } else if (AGENT_ID_KEYS.has(key) && typeof value === "number" && Number.isFinite(value)) {
        ids.add(String(value));
      }
    }
  };

  scanRecord(data.callFact.normalizedArgs);
  data.eventFacts.forEach((evt) => scanRecord(evt.eventArgs));

  return Array.from(ids);
});

// Resolve agent profiles to get name + image
interface ResolvedAgent {
  agentId: string;
  name: string;
  imageSrc: string | null;
}

const resolvedAgents = ref<ResolvedAgent[]>([]);

watch(involvedAgentIds, async (agentIds) => {
  if (agentIds.length === 0) {
    resolvedAgents.value = [];
    return;
  }

  const results: ResolvedAgent[] = [];

  await Promise.all(
    agentIds.map(async (agentId) => {
      try {
        const profile = await api.getAgent(agentId);
        const agentUri = profile.currentUri || profile.agent.agentUri;

        if (!agentUri) {
          results.push({ agentId, name: profile.agent.name || `Agent ${agentId}`, imageSrc: null });
          return;
        }

        let resolved = resolveAgentUri(agentUri);

        if (needsAsyncDataResolve(resolved)) {
          try {
            resolved = await resolveDataUriAsync(agentUri);
          } catch {
            // fallback
          }
        }

        if (FETCHABLE_SCHEMES.has(resolved.scheme) && resolved.decoded === null && !resolved.error) {
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
        const rawImage = metadata.image;
        let imageSrc: string | null = null;
        if (rawImage) {
          imageSrc = rawImage.startsWith("data:") ? rawImage : api.imageProxyUrl(rawImage);
        }

        results.push({
          agentId,
          name: metadata.name ?? (profile.agent.name || `Agent ${agentId}`),
          imageSrc,
        });
      } catch {
        results.push({ agentId, name: `Agent ${agentId}`, imageSrc: null });
      }
    }),
  );

  resolvedAgents.value = results;
}, { immediate: true });

// URI overlay state
const uriOverlayOpen = ref(false);
const uriOverlayRaw = ref("");
const uriOverlayLoading = ref(false);
const uriOverlayResolved = ref<ResolvedUri | null>(null);

async function openUriOverlay(rawUri: string): Promise<void> {
  uriOverlayRaw.value = rawUri;
  uriOverlayResolved.value = null;
  uriOverlayLoading.value = false;
  uriOverlayOpen.value = true;

  const local = resolveAgentUri(rawUri);
  if (local.decoded || local.error || !FETCHABLE_SCHEMES.has(local.scheme)) {
    uriOverlayResolved.value = local;
    return;
  }

  uriOverlayLoading.value = true;
  try {
    const result = await api.resolveUri(rawUri);
    if (result.contentType === "application/json" && result.body !== null) {
      uriOverlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: result.body, error: null };
    } else {
      uriOverlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: null, error: "Response is not JSON" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    uriOverlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: null, error: message };
  }
  uriOverlayLoading.value = false;
}
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="Transaction not indexed"
      empty-description="No decoded transaction was found for this hash."
      @retry="state.refresh"
    >
      <!-- Top summary panel -->
      <v-card border class="mb-3">
        <v-card-text>
          <div class="summary-header">
            <div>
              <div class="summary-title-row">
                <h2 class="summary-title">{{ state.data.value?.callFact.functionName }}</h2>
                <span class="summary-tx-hash summary-full" :title="state.data.value?.transactionFact.txHash">{{ state.data.value?.transactionFact.txHash }}</span>
                <span class="summary-tx-hash summary-truncated" :title="state.data.value?.transactionFact.txHash">{{ formatTxHash(state.data.value?.transactionFact.txHash) }}</span>
                <CopyButton v-if="state.data.value?.transactionFact.txHash" :value="state.data.value.transactionFact.txHash" />
              </div>
              <p class="summary-subtitle">{{ formatTimestamp(state.data.value?.transactionFact.timestamp) }}</p>
            </div>
            <div v-if="resolvedAgents.length > 0" class="summary-agents">
              <a
                v-for="agent in resolvedAgents"
                :key="agent.agentId"
                :href="`/agents/${agent.agentId}`"
                class="agent-pill"
              >
                <v-avatar size="28" class="agent-pill-avatar">
                  <v-img v-if="agent.imageSrc" :src="agent.imageSrc" />
                  <v-icon v-else size="18">mdi-robot</v-icon>
                </v-avatar>
                <span class="agent-pill-name">{{ agent.name }}</span>
                <v-chip size="x-small" color="primary" variant="outlined">#{{ agent.agentId }}</v-chip>
              </a>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-field">
              <dt>From</dt>
              <dd>
                <a :href="`/address/${state.data.value?.transactionFact.from}`" class="summary-full">{{ state.data.value?.transactionFact.from }}</a>
                <a :href="`/address/${state.data.value?.transactionFact.from}`" class="summary-truncated">{{ formatAddress(state.data.value?.transactionFact.from) }}</a>
                <CopyButton v-if="state.data.value?.transactionFact.from" :value="state.data.value.transactionFact.from" />
              </dd>
            </div>
            <div class="summary-field">
              <dt>To</dt>
              <dd>
                <a :href="`/address/${state.data.value?.transactionFact.to}`" class="summary-full">{{ state.data.value?.transactionFact.to }}</a>
                <a :href="`/address/${state.data.value?.transactionFact.to}`" class="summary-truncated">{{ formatAddress(state.data.value?.transactionFact.to) }}</a>
                <CopyButton v-if="state.data.value?.transactionFact.to" :value="state.data.value.transactionFact.to" />
              </dd>
            </div>
            <div class="summary-field">
              <dt>Registry</dt>
              <dd>
                <a :href="`/address/${state.data.value?.transactionFact.registryAddress}`" class="summary-full">{{ state.data.value?.transactionFact.registryAddress }}</a>
                <a :href="`/address/${state.data.value?.transactionFact.registryAddress}`" class="summary-truncated">{{ formatAddress(state.data.value?.transactionFact.registryAddress) }}</a>
                <CopyButton v-if="state.data.value?.transactionFact.registryAddress" :value="state.data.value.transactionFact.registryAddress" />
              </dd>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-row dense>
        <v-col cols="12" md="4">
          <v-card border>
            <v-card-title>Transaction Details</v-card-title>
            <v-card-text>
              <v-table density="compact">
                <tbody>
                  <tr v-for="row in envelopeRows" :key="row.key">
                    <td class="font-weight-medium">{{ row.key }}</td>
                    <td>
                      <span v-if="TRUNCATABLE_ENVELOPE_KEYS.has(row.key)" :title="row.value">{{ formatMiddleTruncate(row.value, 22) }}</span>
                      <span v-else>{{ row.value }}</span>
                      <CopyButton v-if="COPYABLE_ENVELOPE_KEYS.has(row.key)" :value="row.value" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="8">
          <v-card border>
            <v-card-title>Function Call Decode</v-card-title>
            <v-card-subtitle>
              {{ state.data.value?.callFact.functionName }} · {{ state.data.value?.callFact.functionSignature }}
            </v-card-subtitle>
            <v-card-text>
              <v-table density="compact">
                <thead><tr><th>Arg</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="arg in callArgs" :key="arg.key">
                    <td class="font-weight-medium">{{ arg.key }}</td>
                    <td>
                      <a v-if="classifyArgValue(arg.key, arg.value) === 'agentId'" :href="`/agents/${arg.value}`">{{ arg.value }}</a>
                      <a v-else-if="classifyArgValue(arg.key, arg.value) === 'address'" :href="`/address/${arg.value.toLowerCase()}`">{{ arg.value }}</a>
                      <span v-else-if="classifyArgValue(arg.key, arg.value) === 'uri'" class="uri-cell" @click="openUriOverlay(arg.value)" :title="arg.value">
                        {{ arg.value.length > 60 ? arg.value.slice(0, 60) + '…' : arg.value }}
                      </span>
                      <span v-else>{{ arg.value }}</span>
                      <CopyButton :value="arg.value" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>

          <v-card v-for="evt in formattedEvents" :key="evt.logIndex" border class="mt-3">
            <v-card-title>{{ evt.eventName }}</v-card-title>
            <v-card-subtitle>{{ evt.eventSignature }}<template v-if="evt.eventSignature"> · </template>Log #{{ evt.logIndex }}</v-card-subtitle>
            <v-card-text>
              <v-table v-if="evt.args.length > 0" density="compact">
                <thead><tr><th>Arg</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="arg in evt.args" :key="arg.key">
                    <td class="font-weight-medium">{{ arg.key }}</td>
                    <td>
                      <a v-if="classifyArgValue(arg.key, arg.value) === 'agentId'" :href="`/agents/${arg.value}`">{{ arg.value }}</a>
                      <a v-else-if="classifyArgValue(arg.key, arg.value) === 'address'" :href="`/address/${arg.value.toLowerCase()}`">{{ arg.value }}</a>
                      <span v-else-if="classifyArgValue(arg.key, arg.value) === 'uri'" class="uri-cell" @click="openUriOverlay(arg.value)" :title="arg.value">
                        {{ arg.value.length > 60 ? arg.value.slice(0, 60) + '…' : arg.value }}
                      </span>
                      <span v-else>{{ arg.value }}</span>
                      <CopyButton :value="arg.value" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <p v-else class="text-body-2 text-medium-emphasis">No decoded arguments.</p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog v-model="uriOverlayOpen" max-width="800">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Resolved URI</span>
            <v-btn icon="mdi-close" variant="text" size="small" @click="uriOverlayOpen = false" />
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center mb-3">
              <p :class="['uri-raw', 'flex-grow-1', { 'uri-raw-truncated': uriOverlayRaw.startsWith('data:') }]">{{ uriOverlayRaw }}</p>
              <CopyButton :value="uriOverlayRaw" label="Copy URI" />
            </div>

            <v-progress-linear v-if="uriOverlayLoading" indeterminate color="primary" class="mb-2" />

            <template v-else-if="uriOverlayResolved">
              <div v-if="uriOverlayResolved.decoded" class="json-container">
                <vue-json-pretty
                  :data="(uriOverlayResolved.decoded as Record<string, unknown>)"
                  :deep="3"
                  :show-line="true"
                  :collapsed-on-click-brackets="true"
                />
              </div>
              <v-alert v-else-if="uriOverlayResolved.error" type="warning" variant="tonal" density="compact">
                {{ uriOverlayResolved.error }}
              </v-alert>
              <p v-else class="text-body-2 text-medium-emphasis">No content resolved.</p>
            </template>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="uriOverlayOpen = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

    </AsyncStateGate>
  </section>
</template>

<style scoped>
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.summary-title-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.summary-title {
  margin: 0;
  font-size: 1.3rem;
}

.summary-tx-hash {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.summary-subtitle {
  margin: 0.15rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.summary-agents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.agent-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 4px 10px 4px 4px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  text-decoration: none;
  color: var(--color-text-primary);
  background: var(--color-surface-alt);
  transition: background 0.15s ease;
}

.agent-pill:hover {
  background: var(--color-surface-hover);
  text-decoration: none;
}

.agent-pill-avatar {
  flex-shrink: 0;
}

.agent-pill-name {
  font-weight: 600;
  font-size: 0.85rem;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem 1.5rem;
}

.summary-field dt {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-label);
  margin: 0;
}

.summary-field dd {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  word-break: break-all;
}

.summary-truncated {
  display: none;
}

.uri-cell {
  cursor: pointer;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-link-alt);
  max-width: 400px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.uri-cell:hover {
  text-decoration: underline;
}

.uri-raw {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  word-break: break-all;
  margin: 0;
}

.uri-raw-truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.json-container {
  border: 1px solid var(--color-container-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--color-code-bg);
  max-height: 400px;
  overflow: auto;
}

@media (max-width: 959px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-header {
    flex-direction: column;
  }

  .summary-full {
    display: none;
  }

  .summary-truncated {
    display: inline;
  }

  .summary-title-row {
    gap: 0.5rem;
  }

  .v-table {
    min-width: 480px;
  }
}

@media (max-width: 599px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
