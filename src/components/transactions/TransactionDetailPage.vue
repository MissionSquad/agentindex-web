<script setup lang="ts">
import { computed, ref } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatKeyValueMap, formatMiddleTruncate, formatTimestamp } from "../../lib/formatters";
import { isEthereumAddress } from "../../lib/query";
import { resolveAgentUri } from "../../lib/uri-resolver";
import type { ResolvedUri } from "../../lib/uri-resolver";
import { loadTransactionForRoute } from "../../lib/route-loaders";
import { useAsyncView } from "../../lib/view-state";
import type { TransactionDetailResponse } from "../../types/api";

const props = defineProps<{
  txHash: string;
}>();

const api = ScannerApiClient.fromEnv();

const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);
const URI_PREFIXES = ["data:", "http://", "https://", "ipfs://"];
const COPYABLE_ENVELOPE_KEYS = new Set(["Tx Hash", "Registry", "Block Hash", "From", "To"]);
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
    { key: "Registry", value: tx.registryAddress },
    { key: "Block", value: String(tx.blockNumber) },
    { key: "Block Hash", value: tx.blockHash },
    { key: "Index", value: String(tx.transactionIndex) },
    { key: "Timestamp", value: formatTimestamp(tx.timestamp) },
    { key: "From", value: tx.from },
    { key: "To", value: tx.to },
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
      <v-row dense>
        <v-col cols="12" md="5">
          <v-card border>
            <v-card-text>
              <v-table density="compact">
                <tbody>
                  <tr v-for="row in envelopeRows" :key="row.key">
                    <td class="font-weight-medium">{{ row.key }}</td>
                    <td>
                      <a v-if="row.key === 'From' || row.key === 'To' || row.key === 'Registry'" :href="`/address/${row.value}`">{{ row.value }}</a>
                      <span v-else-if="TRUNCATABLE_ENVELOPE_KEYS.has(row.key)" :title="row.value">{{ formatMiddleTruncate(row.value, 32) }}</span>
                      <span v-else>{{ row.value }}</span>
                      <CopyButton v-if="COPYABLE_ENVELOPE_KEYS.has(row.key)" :value="row.value" />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="7">
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
  .v-table {
    min-width: 480px;
  }
}
</style>
