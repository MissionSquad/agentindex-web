<script setup lang="ts">
import { computed, ref, watch } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import CopyButton from "../shared/CopyButton.vue";
import UriOverlay from "../shared/UriOverlay.vue";
import AgentTrustTab from "./AgentTrustTab.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { formatAddress, formatDurationHours, formatNumber, formatPercent, formatTimestamp, formatTxHash } from "../../lib/formatters";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import type { ResolvedUri } from "../../lib/uri-resolver";
import { loadAgentProfileForRoute } from "../../lib/route-loaders";
import { useAsyncView } from "../../lib/view-state";
import type { AgentProfileResponse, FeedbackEntry, ResolvedMetadataLink } from "../../types/api";

const props = defineProps<{
  agentId: string;
}>();

const api = ScannerApiClient.fromEnv();
const currentTab = ref("tx");
const uriOverlay = ref<InstanceType<typeof UriOverlay> | null>(null);

const state = useAsyncView<AgentProfileResponse>(
  () => loadAgentProfileForRoute(api, props.agentId),
  (payload) => payload.agent.agentId.length === 0,
);

const resolvedUri = computed<ResolvedUri>(() => {
  return resolveAgentUri(state.data.value?.currentUri);
});

const remoteFetched = ref<ResolvedUri | null>(null);
const remoteLoading = ref(false);

const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);

watch(resolvedUri, async (uri) => {
  remoteFetched.value = null;
  remoteLoading.value = false;

  // Gzip data URI — decompress async
  if (needsAsyncDataResolve(uri)) {
    remoteLoading.value = true;
    try {
      remoteFetched.value = await resolveDataUriAsync(uri.raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      remoteFetched.value = { scheme: "data-json", raw: uri.raw, decoded: null, error: message };
    }
    remoteLoading.value = false;
    return;
  }

  if (!FETCHABLE_SCHEMES.has(uri.scheme)) {
    return;
  }

  remoteLoading.value = true;
  try {
    const resolved = await api.resolveUri(uri.raw);
    if (resolved.contentType === "application/json" && resolved.body !== null) {
      remoteFetched.value = { scheme: uri.scheme, raw: uri.raw, decoded: resolved.body, error: null };
    } else {
      remoteFetched.value = { scheme: uri.scheme, raw: uri.raw, decoded: null, error: "Response is not JSON" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    remoteFetched.value = { scheme: uri.scheme, raw: uri.raw, decoded: null, error: message };
  }
  remoteLoading.value = false;
}, { immediate: true });

/** The effective resolved URI — prefers the fetched/decompressed result when available. */
const effectiveUri = computed<ResolvedUri>(() => {
  return remoteFetched.value ?? resolvedUri.value;
});

const resolvedMetadata = computed(() => state.data.value?.resolvedMetadata ?? null);
const metadataLinks = computed<ResolvedMetadataLink[]>(() => resolvedMetadata.value?.links ?? []);
const metadataIconLinks = computed<ResolvedMetadataLink[]>(() => {
  const byKind = new Map<ResolvedMetadataLink["kind"], ResolvedMetadataLink>();
  for (const link of metadataLinks.value) {
    if (!byKind.has(link.kind)) {
      byKind.set(link.kind, link);
    }
  }

  const ordered: Array<ResolvedMetadataLink["kind"]> = ["web", "twitter", "email"];
  return ordered.flatMap((kind) => (byKind.has(kind) ? [byKind.get(kind)!] : []));
});
const displayServices = computed<string[]>(() => {
  const rawServices = resolvedMetadata.value?.services ?? state.data.value?.agent.services ?? [];
  const hiddenServices = new Set(["web", "twitter", "email"]);
  return rawServices.filter((service) => !hiddenServices.has(service.toLowerCase()));
});

const agentImageSrc = computed<string | null>(() => {
  const raw = resolvedMetadata.value?.image ?? null;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  return api.imageProxyUrl(raw);
});

const reputationScore = computed(() => {
  const score = state.data.value?.heuristics?.reputationScore;
  if (score === null || score === undefined) return { display: "N/A", color: "default" };
  if (score >= 70) return { display: formatNumber(score), color: "success" };
  if (score >= 40) return { display: formatNumber(score), color: "warning" };
  return { display: formatNumber(score), color: "error" };
});

const heuristicTiles = computed(() => {
  const heuristics = state.data.value?.heuristics;
  if (!heuristics) {
    return [];
  }

  return [
    { label: "Reputation Score", value: formatNumber(heuristics.reputationScore) },
    { label: "Client Diversity", value: formatPercent(heuristics.clientDiversity) },
    { label: "Revocation Rate", value: formatPercent(heuristics.revocationRate) },
    { label: "Response Rate", value: formatPercent(heuristics.responseRate) },
    { label: "Recency Bias", value: `${formatNumber(heuristics.recencyBiasDays)}d` },
    { label: "Time-to-First-Feedback", value: `${formatNumber(heuristics.timeToFirstFeedbackDays)}d` },
    {
      label: "Avg Revocation Latency",
      value: formatDurationHours(heuristics.averageRevocationLatencyHours),
    },
    {
      label: "Avg Response Latency",
      value: formatDurationHours(heuristics.averageResponseLatencyHours),
    },
    { label: "Integrity Pass Rate", value: formatPercent(heuristics.integrityPassRate) },
    { label: "Endpoint Burst Ratio (30d)", value: formatNumber(heuristics.feedbackBurstRatio30d) },
  ];
});

const feedbackHeaders = [
  { title: "Client", key: "clientAddress" },
  { title: "Value", key: "normalizedValue" },
  { title: "Tags", key: "tags" },
  { title: "Endpoint", key: "endpoint" },
  { title: "Feedback", key: "feedbackUri" },
  { title: "Revoked", key: "revoked" },
  { title: "Responses", key: "responseCount" },
  { title: "Timestamp", key: "timestamp" },
  { title: "Tx", key: "txHash" },
];

const responseHeaders = [
  { title: "Responder", key: "responder" },
  { title: "Response URI", key: "responseUri" },
  { title: "Integrity", key: "integrity" },
  { title: "Timestamp", key: "timestamp" },
  { title: "Tx", key: "txHash" },
];

// Resolve feedback URIs to extract a display value (mirrors response pattern on reputation page)
const feedbackValueMap = ref(new Map<string, string>());

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractFeedbackField(decoded: unknown): string | null {
  if (!isRecord(decoded)) return null;
  for (const key of ["feedback", "comment", "message", "text", "review", "response"]) {
    const v = decoded[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

watch(
  () => state.data.value?.feedback.items,
  async (items) => {
    if (!items || items.length === 0) return;

    const map = new Map<string, string>();

    await Promise.all(
      items.map(async (entry) => {
        if (!entry.feedbackUri) return;

        const key = entry.feedbackId;
        let resolved = resolveAgentUri(entry.feedbackUri);

        if (needsAsyncDataResolve(resolved)) {
          try {
            resolved = await resolveDataUriAsync(entry.feedbackUri);
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

        const text = extractFeedbackField(resolved.decoded);
        if (text) {
          map.set(key, text);
        }
      }),
    );

    feedbackValueMap.value = map;
  },
  { immediate: true },
);

function resolvedFeedbackText(entry: FeedbackEntry): string | null {
  return feedbackValueMap.value.get(entry.feedbackId) ?? null;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatTags(entry: FeedbackEntry): string {
  const parts = [entry.tag1, entry.tag2].filter((t) => t.length > 0);
  return parts.length > 0 ? parts.join(", ") : "";
}

interface SummarySegment {
  type: "text" | "address";
  value: string;
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

function metadataLinkIcon(kind: ResolvedMetadataLink["kind"]): string {
  if (kind === "email") return "mdi-email";
  if (kind === "twitter") return "mdi-twitter";
  return "mdi-web";
}

// --- Registration chain parsing ---

interface ChainInfo {
  name: string;
  logo: string;
}

interface ParsedRegistration {
  chainId: number;
  contractAddress: string;
  chain: ChainInfo | null;
  raw: string;
}

const CHAIN_REGISTRY = new Map<number, ChainInfo>([
  [1, { name: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png" }],
  [56, { name: "BNB Smart Chain", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.png" }],
  [137, { name: "Polygon", logo: "https://cryptologos.cc/logos/polygon-matic-logo.png" }],
  [43114, { name: "Avalanche C-Chain", logo: "https://cryptologos.cc/logos/avalanche-avax-logo.png" }],
  [42161, { name: "Arbitrum One", logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.png" }],
  [10, { name: "OP Mainnet", logo: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png" }],
  [8453, { name: "Base", logo: "/base.png" }],
  [25, { name: "Cronos", logo: "https://cryptologos.cc/logos/cronos-cro-logo.png" }],
  [250, { name: "Fantom Opera", logo: "https://cryptologos.cc/logos/fantom-ftm-logo.png" }],
  [5000, { name: "Mantle", logo: "https://cryptologos.cc/logos/mantle-mnt-logo.png" }],
  [100, { name: "Gnosis", logo: "https://cryptologos.cc/logos/gnosis-gno-gno-logo.png" }],
]);

const TESTNET_CHAIN_IDS = new Set<number>([11155111]);

function parseRegistration(raw: string): ParsedRegistration | null {
  const match = raw.match(/^eip155:(\d+):(.+)$/);
  if (!match) return null;

  const chainId = parseInt(match[1], 10);
  if (TESTNET_CHAIN_IDS.has(chainId)) return null;

  return {
    chainId,
    contractAddress: match[2],
    chain: CHAIN_REGISTRY.get(chainId) ?? null,
    raw,
  };
}

const parsedRegistrations = computed<ParsedRegistration[]>(() => {
  const rawList = resolvedMetadata.value?.registrations ?? state.data.value?.agent.registrations ?? [];
  return rawList
    .map((reg) => parseRegistration(reg))
    .filter((entry): entry is ParsedRegistration => entry !== null);
});
</script>

<template>
  <section>
    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="Agent missing"
      empty-description="No profile was found for this agent id."
      @retry="state.refresh"
    >
      <v-card border class="mb-4">
        <v-card-text>
          <div class="header-row">
            <div class="header-identity">
              <img
                v-if="agentImageSrc"
                :src="agentImageSrc"
                alt=""
                class="agent-avatar"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <div>
                <div class="title-row">
                  <h1 class="title">{{ resolvedMetadata?.name ?? state.data.value?.agent.name }}</h1>
                  <v-chip color="primary" size="small">#{{ state.data.value?.agent.agentId }}</v-chip>
                  <v-chip :color="reputationScore.color" size="small" variant="tonal">
                    Rep: {{ reputationScore.display }}
                  </v-chip>
                </div>
                <p class="subtitle">{{ (resolvedMetadata?.description ?? state.data.value?.agent.description) || "No description available." }}</p>
              </div>
            </div>
          </div>

          <!-- Compact summary grid -->
          <div class="agent-summary-grid">
            <div class="summary-field">
              <dt>Agent ID</dt>
              <dd>{{ state.data.value?.agent.agentId }}</dd>
            </div>
            <div class="summary-field">
              <dt>Current Owner</dt>
              <dd>
                <a :href="`/address/${state.data.value?.agent.ownerAddress}`">
                  {{ formatAddress(state.data.value?.agent.ownerAddress) }}
                </a>
                <CopyButton v-if="state.data.value?.agent.ownerAddress" :value="state.data.value.agent.ownerAddress" />
              </dd>
            </div>
            <div class="summary-field">
              <dt>Original Registrant</dt>
              <dd>
                <a :href="`/address/${state.data.value?.agent.originalRegistrant}`">
                  {{ formatAddress(state.data.value?.agent.originalRegistrant) }}
                </a>
                <CopyButton v-if="state.data.value?.agent.originalRegistrant" :value="state.data.value.agent.originalRegistrant" />
              </dd>
            </div>
            <div class="summary-field">
              <dt>Payout Wallet</dt>
              <dd>
                <a v-if="state.data.value?.payoutWallet" :href="`/address/${state.data.value?.payoutWallet}`">
                  {{ formatAddress(state.data.value?.payoutWallet) }}
                </a>
                <CopyButton v-if="state.data.value?.payoutWallet" :value="state.data.value.payoutWallet" />
                <span v-if="!state.data.value?.payoutWallet">N/A</span>
              </dd>
            </div>
            <div class="summary-field">
              <dt>Registration Tx</dt>
              <dd>
                <a :href="`/tx/${state.data.value?.agent.registrationTxHash}`">
                  {{ formatTxHash(state.data.value?.agent.registrationTxHash) }}
                </a>
                <CopyButton v-if="state.data.value?.agent.registrationTxHash" :value="state.data.value.agent.registrationTxHash" />
              </dd>
            </div>
            <div class="summary-field">
              <dt>Registration Date</dt>
              <dd>{{ formatTimestamp(state.data.value?.agent.registrationTimestamp) }}</dd>
            </div>
            <div class="summary-field">
              <dt>Transfer Count</dt>
              <dd>{{ formatNumber(state.data.value?.agent.transferCount) }}</dd>
            </div>
            <div v-if="metadataIconLinks.length > 0" class="summary-field">
              <dt>Links</dt>
              <dd class="summary-link-icons">
                <a
                  v-for="link in metadataIconLinks"
                  :key="`${link.kind}:${link.href}`"
                  :href="link.href"
                  :target="link.kind === 'email' ? undefined : '_blank'"
                  :rel="link.kind === 'email' ? undefined : 'noreferrer noopener'"
                  :title="link.endpoint"
                  :aria-label="`${link.kind} link`"
                  class="summary-link-anchor"
                >
                  <v-chip color="info" variant="text" size="small" class="summary-link-chip">
                    <v-icon size="16">{{ metadataLinkIcon(link.kind) }}</v-icon>
                  </v-chip>
                </a>
              </dd>
            </div>
            <div v-if="resolvedMetadata?.active !== null" class="summary-field">
              <dt>Active</dt>
              <dd>
                <v-chip :color="resolvedMetadata?.active ? 'success' : 'default'" size="small">
                  {{ resolvedMetadata?.active ? "Yes" : "No" }}
                </v-chip>
              </dd>
            </div>
            <div v-if="resolvedMetadata?.erc8004Support !== null" class="summary-field">
              <dt>ERC-8004 Support</dt>
              <dd>
                <v-chip :color="resolvedMetadata?.erc8004Support ? 'success' : 'default'" size="small">
                  {{ resolvedMetadata?.erc8004Support ? "Enabled" : "Disabled" }}
                </v-chip>
              </dd>
            </div>
            <div class="summary-field">
              <dt>x402 Support</dt>
              <dd>
                <v-chip :color="(resolvedMetadata?.x402Support ?? state.data.value?.agent.x402Support) ? 'success' : 'default'" size="small">
                  {{ (resolvedMetadata?.x402Support ?? state.data.value?.agent.x402Support) ? "Enabled" : "Disabled" }}
                </v-chip>
              </dd>
            </div>
            <div v-if="(resolvedMetadata?.supportedTrusts ?? []).length > 0" class="summary-field">
              <dt>Supported Trusts</dt>
              <dd>
                <v-chip v-for="trust in (resolvedMetadata?.supportedTrusts ?? [])" :key="trust" color="info" variant="outlined" size="small" class="mr-1 mb-1">{{ trust }}</v-chip>
              </dd>
            </div>
          </div>

          <div v-if="displayServices.length > 0 || parsedRegistrations.length > 0" class="services-registrations-row mt-3">
            <div v-if="displayServices.length > 0" class="services-section">
              <p class="chip-group-label">Services</p>
              <v-chip-group>
                <v-chip v-for="service in displayServices" :key="service" color="secondary" size="small">{{ service }}</v-chip>
              </v-chip-group>
            </div>
            <div v-if="parsedRegistrations.length > 0" class="registrations-section">
              <p class="chip-group-label">Registrations</p>
              <div class="registration-list">
                <v-tooltip v-for="reg in parsedRegistrations" :key="reg.raw" :text="reg.chain?.name ?? `Chain ${reg.chainId}`" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <img
                      v-if="reg.chain?.logo"
                      v-bind="tooltipProps"
                      :src="reg.chain.logo"
                      :alt="reg.chain.name"
                      class="chain-logo"
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
                    />
                    <v-icon v-else v-bind="tooltipProps" size="20" color="secondary">mdi-link-variant</v-icon>
                  </template>
                </v-tooltip>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-tabs v-model="currentTab" color="primary" class="mb-2" show-arrows>
        <v-tab value="tx">Transaction History</v-tab>
        <v-tab value="ownership">Ownership History</v-tab>
        <v-tab value="uri">URI History</v-tab>
        <v-tab value="trust">Trust Network</v-tab>
        <v-tab value="reputation">Reputation</v-tab>
        <v-tab value="metadata">Metadata</v-tab>
      </v-tabs>

      <v-window v-model="currentTab">
        <v-window-item value="tx">
          <v-card border>
            <v-card-title>Transaction History</v-card-title>
            <v-data-table
              :headers="[
                { title: 'Event', key: 'eventName' },
                { title: 'Summary', key: 'summary' },
                { title: 'Timestamp', key: 'timestamp' },
                { title: 'Tx', key: 'txHash' },
              ]"
              :items="state.data.value?.transactionHistory ?? []"
            >
              <template #item.summary="{ item }">
                <template v-for="(seg, i) in parseSummary(item.summary)" :key="i">
                  <a v-if="seg.type === 'address'" :href="`/address/${seg.value.toLowerCase()}`">{{ formatAddress(seg.value) }}</a>
                  <span v-else>{{ seg.value }}</span>
                </template>
              </template>
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>
        </v-window-item>

        <v-window-item value="ownership">
          <v-card border>
            <v-card-title>Ownership History</v-card-title>
            <v-data-table
              :headers="[
                { title: 'From', key: 'fromAddress' },
                { title: 'To', key: 'toAddress' },
                { title: 'Type', key: 'eventType' },
                { title: 'Timestamp', key: 'timestamp' },
                { title: 'Tx', key: 'txHash' },
              ]"
              :items="state.data.value?.ownershipHistory ?? []"
            >
              <template #item.fromAddress="{ item }"><a :href="`/address/${item.fromAddress}`">{{ formatAddress(item.fromAddress) }}</a> <CopyButton :value="item.fromAddress" /></template>
              <template #item.toAddress="{ item }"><a :href="`/address/${item.toAddress}`">{{ formatAddress(item.toAddress) }}</a> <CopyButton :value="item.toAddress" /></template>
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>
        </v-window-item>

        <v-window-item value="uri">
          <v-card border>
            <v-card-title>URI History</v-card-title>
            <v-data-table
              :headers="[
                { title: 'URI', key: 'uri' },
                { title: 'Updated By', key: 'updatedBy' },
                { title: 'Timestamp', key: 'timestamp' },
                { title: 'Tx', key: 'txHash' },
              ]"
              :items="state.data.value?.uriHistory ?? []"
            >
              <template #item.uri="{ item }">
                <span class="uri-cell" @click="uriOverlay?.open(item.uri)" :title="item.uri">
                  {{ item.uri.length > 60 ? item.uri.slice(0, 60) + '…' : item.uri }}
                </span>
                <CopyButton :value="item.uri" />
              </template>
              <template #item.updatedBy="{ item }"><a :href="`/address/${item.updatedBy}`">{{ formatAddress(item.updatedBy) }}</a> <CopyButton :value="item.updatedBy" /></template>
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>

        </v-window-item>

        <v-window-item value="trust">
          <AgentTrustTab
            v-if="state.data.value"
            :agent-id="state.data.value.agent.agentId"
            :graph="state.data.value.trustNetwork"
            :metrics="state.data.value.trustMetrics"
          />
        </v-window-item>

        <v-window-item value="reputation">
          <!-- Condensed heuristics grid -->
          <div class="heuristics-grid">
            <div class="summary-field" v-for="tile in heuristicTiles" :key="tile.label">
              <dt>{{ tile.label }}</dt>
              <dd>{{ tile.value }}</dd>
            </div>
          </div>

          <v-card border class="mt-3">
            <v-card-title>Feedback</v-card-title>
            <v-data-table
              :headers="feedbackHeaders"
              :items="state.data.value?.feedback.items ?? []"
              :items-per-page="-1"
              density="comfortable"
              hide-default-footer
            >
              <template #item.clientAddress="{ item }">
                <a :href="`/address/${item.clientAddress}`">{{ formatAddress(item.clientAddress) }}</a>
                <CopyButton :value="item.clientAddress" />
              </template>
              <template #item.normalizedValue="{ item }">{{ formatNumber(item.normalizedValue) }}</template>
              <template #item.tags="{ item }">{{ formatTags(item) }}</template>
              <template #item.feedbackUri="{ item }">
                <template v-if="item.feedbackUri">
                  <span class="feedback-text">{{ resolvedFeedbackText(item) ? truncateText(resolvedFeedbackText(item)!, 20) : "..." }}</span>
                  <v-btn
                    icon="mdi-dock-window"
                    variant="text"
                    size="x-small"
                    density="compact"
                    class="overlay-btn"
                    @click="uriOverlay?.open(item.feedbackUri)"
                  />
                </template>
                <span v-else>-</span>
              </template>
              <template #item.revoked="{ item }">{{ item.revoked ? formatTimestamp(item.revokedAt) : "No" }}</template>
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>

          <v-card border class="mt-3">
            <v-card-title>Response Details</v-card-title>
            <v-data-table
              :headers="responseHeaders"
              :items="state.data.value?.responses.items ?? []"
              :items-per-page="-1"
              density="comfortable"
              hide-default-footer
            >
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
              <template #item.integrity="{ item }">
                <v-chip :color="item.integrity === 'pass' ? 'success' : item.integrity === 'fail' ? 'error' : 'default'" size="small">
                  {{ item.integrity }}
                </v-chip>
              </template>
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>
        </v-window-item>

        <v-window-item value="metadata">
          <v-card border>
            <v-card-title>Metadata History</v-card-title>
            <v-data-table
              :headers="[
                { title: 'Key', key: 'key' },
                { title: 'Value', key: 'value' },
                { title: 'Current Value', key: 'currentValue' },
                { title: 'Timestamp', key: 'timestamp' },
                { title: 'Tx', key: 'txHash' },
              ]"
              :items="state.data.value?.metadataHistory ?? []"
            >
              <template #item.timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
              <template #item.txHash="{ item }"><a :href="`/tx/${item.txHash}`">{{ formatTxHash(item.txHash) }}</a> <CopyButton :value="item.txHash" /></template>
            </v-data-table>
          </v-card>
        </v-window-item>
      </v-window>

      <!-- Current URI (moved below tabs) -->
      <v-card border class="mt-3">
        <v-card-text>
          <div class="d-flex align-center">
            <p class="uri-label flex-grow-1">CURRENT URI</p>
            <CopyButton v-if="effectiveUri.raw" :value="effectiveUri.raw" label="Copy URI" />
          </div>

          <!-- Loading remote fetch (HTTP or IPFS) -->
          <template v-if="remoteLoading">
            <v-progress-linear indeterminate color="primary" class="mb-2" />
            <a v-if="effectiveUri.scheme === 'http'" :href="effectiveUri.raw" target="_blank" rel="noreferrer" class="uri-link">
              {{ effectiveUri.raw }}
            </a>
            <p v-else class="uri-raw">{{ effectiveUri.raw }}</p>
          </template>

          <!-- Decoded JSON (from data URI, fetched HTTP, or fetched IPFS) -->
          <template v-else-if="effectiveUri.decoded">
            <a v-if="effectiveUri.scheme === 'http'" :href="effectiveUri.raw" target="_blank" rel="noreferrer" class="uri-link mb-2 d-block">
              {{ effectiveUri.raw }}
            </a>
            <p v-else-if="effectiveUri.scheme === 'ipfs'" class="uri-raw mb-2">{{ effectiveUri.raw }}</p>
            <div class="json-container">
              <vue-json-pretty
                :data="(effectiveUri.decoded as Record<string, unknown>)"
                :deep="2"
                :show-line="true"
                :collapsed-on-click-brackets="true"
              />
            </div>
          </template>

          <!-- Decode or fetch error -->
          <template v-else-if="effectiveUri.error">
            <a v-if="effectiveUri.scheme === 'http'" :href="effectiveUri.raw" target="_blank" rel="noreferrer" class="uri-link mb-2 d-block">
              {{ effectiveUri.raw }}
            </a>
            <p v-else-if="effectiveUri.scheme === 'ipfs'" class="uri-raw mb-2">{{ effectiveUri.raw }}</p>
            <v-alert type="warning" variant="tonal" density="compact">
              {{ effectiveUri.error }}
            </v-alert>
          </template>

          <!-- HTTP URL: no fetch result yet (shouldn't happen but fallback) -->
          <template v-else-if="effectiveUri.scheme === 'http'">
            <a :href="effectiveUri.raw" target="_blank" rel="noreferrer" class="uri-link">
              {{ effectiveUri.raw }}
            </a>
          </template>

          <!-- Data URI (non-JSON) -->
          <template v-else-if="effectiveUri.scheme === 'data-other'">
            <p class="uri-raw text-truncate">{{ effectiveUri.raw }}</p>
          </template>

          <!-- Unknown or empty -->
          <template v-else>
            <p class="uri-raw">{{ effectiveUri.raw || 'N/A' }}</p>
          </template>
        </v-card-text>
      </v-card>
    </AsyncStateGate>

    <UriOverlay ref="uriOverlay" />
  </section>
</template>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title {
  margin: 0;
  font-size: 1.6rem;
}

.subtitle {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
}

.agent-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem 1.5rem;
  padding: 0.5rem 0;
}

.summary-field dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-label);
  margin: 0;
}

.summary-field dd {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  word-break: break-all;
}

@media (max-width: 960px) {
  .agent-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.heuristics-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem 1.5rem;
  padding: 0.5rem 0;
}

@media (max-width: 960px) {
  .heuristics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.uri-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-label);
  margin: 0 0 0.35rem;
}

.json-container {
  border: 1px solid var(--color-container-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--color-code-bg);
  max-height: 400px;
  overflow: auto;
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

.uri-link {
  font-size: 0.9rem;
  word-break: break-all;
}

.header-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.agent-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--color-container-border);
}

.chip-group-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-label);
  margin-bottom: 0.25rem;
}

.summary-link-icons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.summary-link-anchor {
  text-decoration: none;
}

.summary-link-anchor :deep(.v-chip) {
  cursor: pointer;
}

.summary-link-chip {
  min-width: 34px;
  justify-content: center;
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

.feedback-text {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.services-registrations-row {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
}

.registration-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chain-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  cursor: default;
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

@media (max-width: 599px) {
  .title-row {
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .title {
    font-size: 1.2rem;
  }

  .agent-summary-grid,
  .heuristics-grid {
    grid-template-columns: 1fr;
  }

  .header-identity {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
