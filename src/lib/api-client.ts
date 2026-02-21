import {
  type AgentMetadataSearchItem,
  type AgentMetadataSearchQuery,
  type AgentMetadataSearchResponse,
  type AddressProfileResponse,
  type AgentListQuery,
  type AgentProfileResponse,
  type AgentSummary,
  type AnalyticsOverviewResponse,
  type ApiErrorPayload,
  type CallFact,
  type EventFact,
  type FeedbackEntry,
  type HealthResponse,
  type MetadataHistoryEntry,
  type NetworkEdgeInput,
  type NetworkGraphQuery,
  type NetworkGraphResponse,
  type NetworkNodeInput,
  type OwnershipEvent,
  type PaginatedResult,
  type PaginationMeta,
  type ReputationListQuery,
  type ReputationResponse,
  type ResolvedAgentMetadata,
  type ResolvedMetadataLink,
  type ResolveUriResponse,
  type ResponseEntry,
  type SearchQuery,
  type SearchResultItem,
  type SearchResponse,
  type TimeSeriesPoint,
  type TopAgentSummary,
  type TransactionDetailResponse,
  type TransactionEnvelope,
  type UriHistoryEntry,
  type WindowedHeuristics,
  type WindowedValue,
} from "../types/api";
import { buildQueryString, type QueryValue } from "./query";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toNullableNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

function unwrapEnvelope(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if ("data" in value && Object.keys(value).length === 1) {
    return value.data;
  }

  return value;
}

function parsePaginationMeta(value: unknown, itemCount: number): PaginationMeta {
  const record = asRecord(value);
  const metaRecord = asRecord(record.meta ?? record.pagination ?? record.pageInfo);

  const page = toNumberValue(metaRecord.page ?? record.page, 1);
  const limit = toNumberValue(metaRecord.limit ?? record.limit, itemCount === 0 ? 25 : itemCount);
  const total = toNumberValue(metaRecord.total ?? record.total, itemCount);

  return {
    page,
    limit,
    total,
    hasNextPage: page * limit < total,
  };
}

function parsePaginated<T>(value: unknown, parser: (entry: unknown) => T): PaginatedResult<T> {
  if (Array.isArray(value)) {
    return {
      items: value.map((entry) => parser(entry)),
      meta: parsePaginationMeta({ items: value }, value.length),
    };
  }

  const record = asRecord(value);
  const rawItems = record.items ?? record.results ?? record.rows ?? record.feedback ?? record.responses ?? record.data;
  const itemsSource = Array.isArray(rawItems) ? rawItems : [];
  const items = itemsSource.map((entry) => parser(entry));

  return {
    items,
    meta: parsePaginationMeta(value, items.length),
  };
}

function parseAgentSummary(value: unknown): AgentSummary {
  const record = asRecord(value);
  const agentId = toStringValue(record.agentId);

  return {
    chainId: toNumberValue(record.chainId, 1),
    agentId,
    ownerAddress: toStringValue(record.ownerAddress ?? record.owner),
    originalRegistrant: toStringValue(record.originalRegistrant ?? record.registrant),
    agentUri: toStringValue(record.agentUri ?? record.agentURI ?? record.currentUri),
    name: toStringValue(record.name, agentId ? `Agent ${agentId}` : "Unnamed Agent"),
    description: toStringValue(record.description),
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
    tags: toStringArray(record.tags),
    services: toStringArray(record.services),
    x402Support: toBooleanValue(record.x402Support),
    type: typeof record.type === "string" ? record.type : null,
    active: typeof record.active === "boolean" ? record.active : null,
    erc8004Support: typeof record.erc8004Support === "boolean" ? record.erc8004Support : null,
    registrations: toStringArray(record.registrations),
    supportedTrusts: toStringArray(record.supportedTrusts),
    registrationTxHash: toStringValue(record.registrationTxHash),
    registrationTimestamp: toNumberValue(record.registrationTimestamp),
    hasBeenTransferred: toBooleanValue(record.hasBeenTransferred),
    transferCount: toNumberValue(record.transferCount),
    feedbackCount: toNumberValue(record.feedbackCount),
    responseCount: toNumberValue(record.responseCount),
    averageReputation: toNullableNumberValue(record.averageReputation),
    lastActiveTimestamp: toNullableNumberValue(record.lastActiveTimestamp),
  };
}

function parseFeedbackEntry(value: unknown): FeedbackEntry {
  const record = asRecord(value);

  return {
    feedbackId: toStringValue(record.feedbackId),
    agentId: toStringValue(record.agentId),
    clientAddress: toStringValue(record.clientAddress),
    feedbackIndex: toNumberValue(record.feedbackIndex),
    value: toNumberValue(record.value),
    valueDecimals: toNumberValue(record.valueDecimals),
    normalizedValue: toNumberValue(record.normalizedValue),
    tag1: toStringValue(record.tag1),
    tag2: toStringValue(record.tag2),
    endpoint: toStringValue(record.endpoint),
    feedbackUri: toStringValue(record.feedbackUri),
    feedbackHash: toStringValue(record.feedbackHash),
    integrity:
      record.integrity === "pass" || record.integrity === "fail" || record.integrity === "unknown"
        ? record.integrity
        : "unknown",
    revoked: toBooleanValue(record.revoked),
    revokedAt: toNullableNumberValue(record.revokedAt),
    responseCount: toNumberValue(record.responseCount),
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseResponseEntry(value: unknown): ResponseEntry {
  const record = asRecord(value);

  return {
    responseId: toStringValue(record.responseId),
    agentId: toStringValue(record.agentId),
    clientAddress: toStringValue(record.clientAddress),
    feedbackIndex: toNumberValue(record.feedbackIndex),
    responder: toStringValue(record.responder),
    responseUri: toStringValue(record.responseUri),
    responseHash: toStringValue(record.responseHash),
    integrity:
      record.integrity === "pass" || record.integrity === "fail" || record.integrity === "unknown"
        ? record.integrity
        : "unknown",
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseOwnershipEvent(value: unknown): OwnershipEvent {
  const record = asRecord(value);

  return {
    fromAddress: toStringValue(record.fromAddress),
    toAddress: toStringValue(record.toAddress),
    eventType: record.eventType === "mint" ? "mint" : "transfer",
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseUriHistoryEntry(value: unknown): UriHistoryEntry {
  const record = asRecord(value);
  return {
    uri: toStringValue(record.uri),
    updatedBy: toStringValue(record.updatedBy),
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseMetadataHistoryEntry(value: unknown): MetadataHistoryEntry {
  const record = asRecord(value);
  return {
    key: toStringValue(record.key),
    value: toStringValue(record.value),
    currentValue: toStringValue(record.currentValue),
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseTimeSeriesPoint(value: unknown): TimeSeriesPoint {
  const record = asRecord(value);
  const rawLabel = typeof record.label === "string" && record.label.length > 0 ? record.label : undefined;

  return {
    timestamp: toNumberValue(record.timestamp),
    value: toNumberValue(record.value),
    label: rawLabel,
  };
}

function parseNetworkNodeInput(value: unknown): NetworkNodeInput {
  const record = asRecord(value);
  const kind = record.kind === "agent" || record.kind === "address" || record.kind === "feedback" ? record.kind : undefined;

  return {
    id: typeof record.id === "string" ? record.id : undefined,
    chainId: typeof record.chainId === "number" ? record.chainId : undefined,
    agentId: typeof record.agentId === "string" ? record.agentId : undefined,
    address: typeof record.address === "string" ? record.address : undefined,
    kind,
    name: typeof record.name === "string" ? record.name : undefined,
    meta: isRecord(record.meta) ? record.meta : undefined,
  };
}

function parseNetworkEdgeInput(value: unknown): NetworkEdgeInput {
  const record = asRecord(value);
  const kind =
    record.kind === "review" ||
    record.kind === "registrant" ||
    record.kind === "agent-review" ||
    record.kind === "response"
      ? record.kind
      : "review";

  return {
    id: typeof record.id === "string" ? record.id : undefined,
    source: toStringValue(record.source),
    target: toStringValue(record.target),
    kind,
    weight: typeof record.weight === "number" ? record.weight : undefined,
    firstSeen: typeof record.firstSeen === "number" ? record.firstSeen : undefined,
    lastSeen: typeof record.lastSeen === "number" ? record.lastSeen : undefined,
    txHash: typeof record.txHash === "string" ? record.txHash : undefined,
  };
}

function parseNetworkGraphResponse(value: unknown): NetworkGraphResponse {
  const record = asRecord(value);
  const metrics = asRecord(record.metrics ?? record.meta);
  const meta = asRecord(record.meta);

  const directNodes = toRecordArray(record.nodes);
  const directEdges = toRecordArray(record.edges);

  let nodesSource = directNodes;
  if (nodesSource.length === 0) {
    const legacyNodes = asRecord(record.nodes);
    const agentNodes = toStringArray(legacyNodes.agents ?? []).map((agentId) => ({
      kind: "agent",
      chainId: toNumberValue(record.chainId ?? asRecord(record.meta).chainId, 1),
      agentId,
      name: `Agent ${agentId}`,
    }));
    const addressNodes = toStringArray(legacyNodes.addresses ?? []).map((address) => ({
      kind: "address",
      address,
      name: address,
    }));
    nodesSource = [...agentNodes, ...addressNodes];
  }

  let edgesSource = directEdges;
  if (edgesSource.length === 0) {
    const legacyEdges = asRecord(record.edges);
    const agentReviewEdges = toRecordArray(legacyEdges.agentReviews).map((entry) => ({
      kind: "agent-review",
      source: toStringValue(entry.sourceAgentId),
      target: toStringValue(entry.targetAgentId),
      txHash: toStringValue(entry.txHash),
      firstSeen: toNumberValue(entry.timestamp),
      lastSeen: toNumberValue(entry.timestamp),
    }));
    const registrantEdges = toRecordArray(legacyEdges.registrants).map((entry) => ({
      kind: "registrant",
      source: toStringValue(entry.ownerAddress),
      target: toStringValue(entry.sourceAgentId),
      txHash: toStringValue(entry.txHash),
      firstSeen: toNumberValue(entry.timestamp),
      lastSeen: toNumberValue(entry.timestamp),
    }));
    const responseEdges = toRecordArray(legacyEdges.responses).map((entry) => ({
      kind: "response",
      source: toStringValue(entry.responder),
      target: toStringValue(entry.targetAgentId),
      txHash: toStringValue(entry.txHash),
      firstSeen: toNumberValue(entry.timestamp),
      lastSeen: toNumberValue(entry.timestamp),
    }));
    edgesSource = [...agentReviewEdges, ...registrantEdges, ...responseEdges];
  }

  return {
    nodes: nodesSource.map((entry) => parseNetworkNodeInput(entry)),
    edges: edgesSource.map((entry) => parseNetworkEdgeInput(entry)),
    metrics: {
      reciprocalReviewRatioGlobal: toNullableNumberValue(metrics.reciprocalReviewRatioGlobal),
      isolatedClusterShare: toNullableNumberValue(metrics.isolatedClusterShare),
      networkBridgeCount: toNumberValue(metrics.networkBridgeCount),
    },
    meta: {
      edgeLimitApplied: toNumberValue(meta.edgeLimitApplied, edgesSource.length),
      truncated: typeof meta.truncated === "boolean" ? meta.truncated : false,
    },
  };
}

function parseHealthResponse(value: unknown): HealthResponse {
  const record = asRecord(value);
  const status = record.status === "ok" || record.status === "degraded" || record.status === "down" ? record.status : "down";
  const rawUpdatedAt = record.updatedAt ?? record.timestamp;
  const updatedAtCandidate =
    typeof rawUpdatedAt === "string"
      ? Date.parse(rawUpdatedAt)
      : toNumberValue(rawUpdatedAt);
  const updatedAt = Number.isFinite(updatedAtCandidate) ? updatedAtCandidate : 0;

  return {
    status,
    chainId: toNumberValue(record.chainId, 1),
    latestSyncedBlock: toNumberValue(record.latestSyncedBlock ?? record.lastSyncedBlock),
    updatedAt,
  };
}

function parseWindowedValue(value: unknown): WindowedValue {
  const record = asRecord(value);
  return {
    d24h: toNullableNumberValue(record.d24h),
    d7d: toNullableNumberValue(record.d7d),
    d30d: toNullableNumberValue(record.d30d),
  };
}

function parseWindowedHeuristics(value: unknown): WindowedHeuristics {
  const record = asRecord(value);
  return {
    ecosystemGrowthVelocity: parseWindowedValue(record.ecosystemGrowthVelocity),
    feedbackDensity: parseWindowedValue(record.feedbackDensity),
    dormantAgentRatio: parseWindowedValue(record.dormantAgentRatio),
    responseEngagementRate: parseWindowedValue(record.responseEngagementRate),
    transferRate: parseWindowedValue(record.transferRate),
  };
}

function parseTopAgentSummary(value: unknown): TopAgentSummary {
  const record = asRecord(value);
  return {
    agentId: toStringValue(record.agentId),
    value: toNumberValue(record.value),
    agentUri: toStringValue(record.agentUri),
    name: typeof record.name === "string" ? record.name : null,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : null,
    reputationScore: toNullableNumberValue(record.reputationScore),
    clientDiversity: toNullableNumberValue(record.clientDiversity),
  };
}

function isAllowedLinkHref(value: string): boolean {
  if (value.startsWith("mailto:")) {
    return value.length > "mailto:".length;
  }

  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function parseResolvedMetadataLink(value: unknown): ResolvedMetadataLink | null {
  const record = asRecord(value);
  if (record.kind !== "web" && record.kind !== "email" && record.kind !== "twitter") {
    return null;
  }

  const href = toStringValue(record.href);
  if (!isAllowedLinkHref(href)) {
    return null;
  }

  const label = toStringValue(record.label);
  if (label.length === 0) {
    return null;
  }

  const endpoint = toStringValue(record.endpoint);
  if (endpoint.length === 0) {
    return null;
  }

  const serviceName = typeof record.serviceName === "string" ? record.serviceName : null;

  return {
    kind: record.kind,
    label,
    href,
    endpoint,
    serviceName,
  };
}

function parseResolvedMetadata(value: unknown): ResolvedAgentMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const links = toRecordArray(value.links)
    .map((entry) => parseResolvedMetadataLink(entry))
    .filter((entry): entry is ResolvedMetadataLink => entry !== null);

  return {
    links,
    name: typeof value.name === "string" ? value.name : null,
    description: typeof value.description === "string" ? value.description : null,
    type: typeof value.type === "string" ? value.type : null,
    image: typeof value.image === "string" ? value.image : null,
    active: typeof value.active === "boolean" ? value.active : null,
    x402Support: typeof value.x402Support === "boolean" ? value.x402Support : null,
    erc8004Support: typeof value.erc8004Support === "boolean" ? value.erc8004Support : null,
    services: toStringArray(value.services),
    registrations: toStringArray(value.registrations),
    supportedTrusts: toStringArray(value.supportedTrusts),
    resolveStatus:
      value.resolveStatus === "resolved" || value.resolveStatus === "failed" || value.resolveStatus === "pending"
        ? value.resolveStatus
        : "pending",
    resolvedAt: toNumberValue(value.resolvedAt),
  };
}

function parseAnalyticsOverviewResponse(value: unknown): AnalyticsOverviewResponse {
  const record = asRecord(value);
  const dashboardMetrics = asRecord(record.dashboardMetrics);
  const heuristics = asRecord(record.heuristics);
  const charts = asRecord(record.charts);

  const hasDashboardMetrics = Object.keys(dashboardMetrics).length > 0;
  const hasHeuristics = Object.keys(heuristics).length > 0;

  return {
    dashboardMetrics: {
      totalRegisteredAgents: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.totalRegisteredAgents : record.totalAgents,
      ),
      newAgents24h: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.newAgents24h : record.newAgents24h,
      ),
      newAgents7d: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.newAgents7d : record.newAgents7d,
      ),
      newAgents30d: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.newAgents30d : record.newAgents30d,
      ),
      totalFeedbackSubmitted: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.totalFeedbackSubmitted : record.totalFeedback,
      ),
      activeFeedback: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.activeFeedback : record.activeFeedback,
      ),
      uniqueClientAddresses: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.uniqueClientAddresses : record.uniqueClients,
      ),
      totalResponsesAppended: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.totalResponsesAppended : record.totalResponses,
      ),
      agentTransfers: toNumberValue(
        hasDashboardMetrics ? dashboardMetrics.agentTransfers : record.agentTransfers,
      ),
    },
    heuristics: {
      ecosystemGrowthVelocity: toNullableNumberValue(
        hasHeuristics ? heuristics.ecosystemGrowthVelocity : record.ecosystemGrowthVelocity,
      ),
      feedbackDensity: toNullableNumberValue(
        hasHeuristics ? heuristics.feedbackDensity : record.feedbackDensity,
      ),
      revocationRate: toNullableNumberValue(
        hasHeuristics ? heuristics.revocationRate : record.revocationRate,
      ),
      dormantAgentRatio: toNullableNumberValue(
        hasHeuristics ? heuristics.dormantAgentRatio : record.dormantAgentRatio,
      ),
      responseEngagementRate: toNullableNumberValue(
        hasHeuristics ? heuristics.responseEngagementRate : record.responseEngagementRate,
      ),
      transferRate: toNullableNumberValue(
        hasHeuristics ? heuristics.transferRate : record.transferRate,
      ),
      networkGiniCoefficient: toNullableNumberValue(heuristics.networkGiniCoefficient),
      responderConcentration: toNullableNumberValue(heuristics.responderConcentration),
    },
    windowedHeuristics: parseWindowedHeuristics(record.windowedHeuristics),
    charts: {
      registrations: toRecordArray(charts.registrations).map((entry) => parseTimeSeriesPoint(entry)),
      feedbackVolume: toRecordArray(charts.feedbackVolume).map((entry) => parseTimeSeriesPoint(entry)),
      responseVolume: toRecordArray(charts.responseVolume).map((entry) => parseTimeSeriesPoint(entry)),
      revocationVolume: toRecordArray(charts.revocationVolume).map((entry) => parseTimeSeriesPoint(entry)),
      activeAgents: toRecordArray(charts.activeAgents).map((entry) => parseTimeSeriesPoint(entry)),
      clientGrowth: toRecordArray(charts.clientGrowth).map((entry) => parseTimeSeriesPoint(entry)),
      responderGrowth: toRecordArray(charts.responderGrowth).map((entry) => parseTimeSeriesPoint(entry)),
      transferVolume: toRecordArray(charts.transferVolume).map((entry) => parseTimeSeriesPoint(entry)),
      integrityHealth: toRecordArray(charts.integrityHealth).map((entry) => parseTimeSeriesPoint(entry)),
      topAgentsByFeedback: toRecordArray(charts.topAgentsByFeedback).map((entry) => parseTopAgentSummary(entry)),
      tagHeatmap: toRecordArray(charts.tagHeatmap).map((entry) => ({
        x: toStringValue(entry.x),
        y: toStringValue(entry.y),
        value: toNumberValue(entry.value),
      })),
      endpointHeatmap: toRecordArray(charts.endpointHeatmap).map((entry) => ({
        x: toStringValue(entry.x),
        y: toStringValue(entry.y),
        value: toNumberValue(entry.value),
      })),
      protocolDistribution: toRecordArray(charts.protocolDistribution).map((entry) => ({
        label: toStringValue(entry.label),
        value: toNumberValue(entry.value),
      })),
      timeToFirstFeedbackDistribution: toRecordArray(charts.timeToFirstFeedbackDistribution).map((entry) => ({
        label: toStringValue(entry.label),
        value: toNumberValue(entry.value),
      })),
      selectedAgentFeedbackVelocity: toRecordArray(charts.selectedAgentFeedbackVelocity).map((entry) =>
        parseTimeSeriesPoint(entry),
      ),
    },
    activityFeed: toRecordArray(record.activityFeed).map((entry) => ({
      eventName: toStringValue(entry.eventName),
      agentId: typeof entry.agentId === "string" ? entry.agentId : null,
      txHash: toStringValue(entry.txHash),
      timestamp: toNumberValue(entry.timestamp),
      summary: toStringValue(entry.summary),
    })),
  };
}

function parseReputationResponse(value: unknown): ReputationResponse {
  const record = asRecord(value);
  const metrics = asRecord(record.metrics);
  const heuristics = asRecord(record.heuristics);
  const hasCanonicalMetrics = "totalFeedbackEntries" in metrics || "totalResponsesAppended" in metrics;
  const hasCanonicalHeuristics =
    "feedbackVelocity" in heuristics || "responderDiversity" in heuristics || "integrityFailureRate" in heuristics;

  const recentFeedbackSource = record.recentFeedback ?? record.data;
  const recentResponsesSource = record.recentResponses ?? record.responses ?? [];

  return {
    metrics: {
      totalFeedbackEntries: toNumberValue(
        hasCanonicalMetrics ? metrics.totalFeedbackEntries : metrics.totalFeedback,
      ),
      totalRevocations: toNumberValue(
        hasCanonicalMetrics ? metrics.totalRevocations : metrics.totalRevocations,
      ),
      totalResponsesAppended: toNumberValue(
        hasCanonicalMetrics ? metrics.totalResponsesAppended : metrics.totalResponses,
      ),
      uniqueAgentsWithFeedback: toNumberValue(
        hasCanonicalMetrics ? metrics.uniqueAgentsWithFeedback : metrics.uniqueAgentsWithFeedback,
      ),
      uniqueClients: toNumberValue(hasCanonicalMetrics ? metrics.uniqueClients : metrics.uniqueClients),
      uniqueResponders: toNumberValue(metrics.uniqueResponders),
      mostActiveClient: typeof metrics.mostActiveClient === "string" ? metrics.mostActiveClient : null,
      mostReviewedAgent: typeof metrics.mostReviewedAgent === "string" ? metrics.mostReviewedAgent : null,
      mostActiveResponder: typeof metrics.mostActiveResponder === "string" ? metrics.mostActiveResponder : null,
    },
    heuristics: {
      feedbackVelocity: toNullableNumberValue(hasCanonicalHeuristics ? heuristics.feedbackVelocity : null),
      responderDiversity: toNullableNumberValue(hasCanonicalHeuristics ? heuristics.responderDiversity : null),
      integrityFailureRate: toNullableNumberValue(hasCanonicalHeuristics ? heuristics.integrityFailureRate : null),
      sybilSuspicionAgents: toStringArray(heuristics.sybilSuspicionAgents),
      tagDistribution: asRecord(heuristics.tagDistribution) as Record<string, number>,
      endpointPopularity: asRecord(heuristics.endpointPopularity) as Record<string, number>,
    },
    recentFeedback: parsePaginated(recentFeedbackSource, parseFeedbackEntry),
    recentResponses: parsePaginated(recentResponsesSource, parseResponseEntry),
    agentNames: isRecord(record.agentNames)
      ? Object.fromEntries(
          Object.entries(record.agentNames)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, value as string]),
        )
      : {},
  };
}

function parseTransactionEnvelope(value: unknown): TransactionEnvelope {
  const record = asRecord(value);

  return {
    txHash: toStringValue(record.txHash),
    chainId: toNumberValue(record.chainId, 1),
    registryAddress: toStringValue(record.registryAddress),
    blockNumber: toNumberValue(record.blockNumber),
    blockHash: toStringValue(record.blockHash),
    transactionIndex: toNumberValue(record.transactionIndex),
    timestamp: toNumberValue(record.timestamp),
    status: "success",
    from: toStringValue(record.from),
    to: toStringValue(record.to),
    nonce: toNumberValue(record.nonce),
    value: toStringValue(record.value),
    gas: toStringValue(record.gas),
    gasUsed: toStringValue(record.gasUsed),
    gasPrice: toStringValue(record.gasPrice),
    maxFeePerGas: typeof record.maxFeePerGas === "string" ? record.maxFeePerGas : null,
    maxPriorityFeePerGas: typeof record.maxPriorityFeePerGas === "string" ? record.maxPriorityFeePerGas : null,
    cumulativeGasUsed: toStringValue(record.cumulativeGasUsed),
  };
}

function parseCallFact(value: unknown): CallFact {
  const record = asRecord(value);

  return {
    functionName: toStringValue(record.functionName),
    functionSignature: toStringValue(record.functionSignature),
    rawArgs: asRecord(record.rawArgs),
    normalizedArgs: asRecord(record.normalizedArgs),
  };
}

function parseEventFact(value: unknown): EventFact {
  const record = asRecord(value);

  return {
    logIndex: toNumberValue(record.logIndex),
    topic0: toStringValue(record.topic0),
    topics: toStringArray(record.topics),
    data: toStringValue(record.data),
    eventName: toStringValue(record.eventName),
    eventSignature: toStringValue(record.eventSignature),
    eventArgs: asRecord(record.eventArgs),
    timestamp: toNumberValue(record.timestamp),
    txHash: toStringValue(record.txHash),
  };
}

function parseTransactionDetailResponse(value: unknown): TransactionDetailResponse {
  const record = asRecord(value);

  return {
    transactionFact: parseTransactionEnvelope(record.transactionFact ?? record.transaction),
    callFact: parseCallFact(record.callFact ?? record.call),
    eventFacts: toRecordArray(record.eventFacts ?? record.events).map((entry) => parseEventFact(entry)),
    relatedAgents: toRecordArray(record.relatedAgents).map((entry) => ({
      agentId: toStringValue(entry.agentId),
      name: toStringValue(entry.name, `Agent ${toStringValue(entry.agentId)}`),
      imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : null,
    })),
  };
}

function parseAddressProfileResponse(value: unknown): AddressProfileResponse {
  const record = asRecord(value);
  const owner = asRecord(record.owner ?? record.asOwner);
  const feedbackClient = asRecord(record.feedbackClient ?? record.asClient);
  const responder = asRecord(record.responder ?? record.asResponder);

  return {
    address: toStringValue(record.address),
    owner: {
      agentsCurrentlyOwned: toStringArray(owner.agentsCurrentlyOwned),
      agentsOriginallyRegistered: toStringArray(owner.agentsOriginallyRegistered ?? owner.agents),
      agentsTransferredAway: toStringArray(owner.agentsTransferredAway),
      agentsReceivedViaTransfer: toStringArray(owner.agentsReceivedViaTransfer),
    },
    feedbackClient: {
      feedback: parsePaginated(feedbackClient.feedback ?? feedbackClient.recentFeedback, parseFeedbackEntry),
      agentsReviewed: toStringArray(feedbackClient.agentsReviewed),
      revocationCount: toNumberValue(feedbackClient.revocationCount),
      averageScoreGiven: toNullableNumberValue(feedbackClient.averageScoreGiven),
      feedbackIntegrityRate: toNullableNumberValue(feedbackClient.feedbackIntegrityRate),
    },
    responder: {
      responses: parsePaginated(responder.responses ?? responder.recentResponses, parseResponseEntry),
      agentsRespondedTo: toStringArray(responder.agentsRespondedTo),
      responseCount: toNumberValue(responder.responseCount),
      averageResponseLatencyHours: toNullableNumberValue(responder.averageResponseLatencyHours),
    },
    payoutWalletAgentIds: toStringArray(record.payoutWalletAgentIds),
    uriUpdateCount: toNumberValue(record.uriUpdateCount),
  };
}

function parseAgentProfileResponse(value: unknown): AgentProfileResponse {
  const record = asRecord(value);
  const reputationSummary = asRecord(record.reputationSummary);
  const trustMetrics = asRecord(record.trustMetrics);
  const heuristics = asRecord(record.heuristics);

  return {
    agent: parseAgentSummary(record.agent),
    resolvedMetadata: parseResolvedMetadata(record.resolvedMetadata),
    payoutWallet: typeof record.payoutWallet === "string" ? record.payoutWallet : null,
    currentUri: toStringValue(record.currentUri),
    reputationSummary: {
      count: toNumberValue(reputationSummary.count),
      summaryValue: toNumberValue(reputationSummary.summaryValue),
      summaryValueDecimals: toNumberValue(reputationSummary.summaryValueDecimals),
    },
    feedback: parsePaginated(record.feedback, parseFeedbackEntry),
    responses: parsePaginated(record.responses, parseResponseEntry),
    ownershipHistory: toRecordArray(record.ownershipHistory).map((entry) => parseOwnershipEvent(entry)),
    uriHistory: toRecordArray(record.uriHistory).map((entry) => parseUriHistoryEntry(entry)),
    metadataHistory: toRecordArray(record.metadataHistory).map((entry) => parseMetadataHistoryEntry(entry)),
    transactionHistory: toRecordArray(record.transactionHistory).map((entry) => ({
      eventName: toStringValue(entry.eventName),
      txHash: toStringValue(entry.txHash),
      timestamp: toNumberValue(entry.timestamp),
      summary: toStringValue(entry.summary),
    })),
    trustNetwork: parseNetworkGraphResponse(record.trustNetwork),
    trustMetrics: {
      reciprocalReviewRatio: toNullableNumberValue(trustMetrics.reciprocalReviewRatio),
      closedClusterRatio: toNullableNumberValue(trustMetrics.closedClusterRatio),
      connectedBuilderCount: toNumberValue(trustMetrics.connectedBuilderCount),
    },
    heuristics: {
      reputationScore: toNullableNumberValue(heuristics.reputationScore),
      clientDiversity: toNullableNumberValue(heuristics.clientDiversity),
      revocationRate: toNullableNumberValue(heuristics.revocationRate),
      responseRate: toNullableNumberValue(heuristics.responseRate),
      recencyBiasDays: toNullableNumberValue(heuristics.recencyBiasDays),
      timeToFirstFeedbackDays: toNullableNumberValue(heuristics.timeToFirstFeedbackDays),
      averageRevocationLatencyHours: toNullableNumberValue(heuristics.averageRevocationLatencyHours),
      averageResponseLatencyHours: toNullableNumberValue(heuristics.averageResponseLatencyHours),
      integrityPassRate: toNullableNumberValue(heuristics.integrityPassRate),
      feedbackBurstRatio30d: toNullableNumberValue(heuristics.feedbackBurstRatio30d),
      reciprocalReviewRatio: toNullableNumberValue(heuristics.reciprocalReviewRatio),
      closedClusterRatio: toNullableNumberValue(heuristics.closedClusterRatio),
      connectedBuilderCount: toNumberValue(heuristics.connectedBuilderCount),
    },
  };
}

function parseSearchResponse(value: unknown): SearchResponse {
  const record = asRecord(value);
  const hasStructuredResults = isRecord(record.results);
  const paginated = parsePaginated(hasStructuredResults ? record.results : legacySearchResults(record), (entry) => {
    const row = asRecord(entry);

    let type: "agent" | "address" | "transaction" | "tag" | "endpoint" = "agent";
    if (
      row.type === "agent" ||
      row.type === "address" ||
      row.type === "transaction" ||
      row.type === "tag" ||
      row.type === "endpoint"
    ) {
      type = row.type;
    }

    return {
      type,
      id: toStringValue(row.id),
      title: toStringValue(row.title),
      subtitle: toStringValue(row.subtitle),
      route: toStringValue(row.route),
    };
  });

  return {
    query: toStringValue(record.query ?? record.q),
    results: paginated,
  };
}

function parseMetadataSearchStatus(value: unknown): "resolved" | "failed" | "pending" {
  return value === "resolved" || value === "failed" || value === "pending" ? value : "pending";
}

function parseAgentMetadataSearchItem(value: unknown): AgentMetadataSearchItem {
  const record = asRecord(value);
  return {
    chainId: toNumberValue(record.chainId, 1),
    agentId: toStringValue(record.agentId),
    uri: toStringValue(record.uri),
    name: typeof record.name === "string" ? record.name : null,
    description: typeof record.description === "string" ? record.description : null,
    type: typeof record.type === "string" ? record.type : null,
    image: typeof record.image === "string" ? record.image : null,
    active: typeof record.active === "boolean" ? record.active : null,
    x402Support: typeof record.x402Support === "boolean" ? record.x402Support : null,
    erc8004Support: typeof record.erc8004Support === "boolean" ? record.erc8004Support : null,
    services: toStringArray(record.services),
    registrations: toStringArray(record.registrations),
    supportedTrusts: toStringArray(record.supportedTrusts),
    resolveStatus: parseMetadataSearchStatus(record.resolveStatus),
    resolvedAt: toNumberValue(record.resolvedAt),
  };
}

function parseAgentMetadataSearchResponse(value: unknown): AgentMetadataSearchResponse {
  const record = asRecord(value);
  return {
    query: toStringValue(record.query ?? record.q),
    filters: isRecord(record.filters) ? record.filters : {},
    results: parsePaginated(record.results, parseAgentMetadataSearchItem),
  };
}

function toSearchResultFromMetadataItem(item: AgentMetadataSearchItem): SearchResultItem {
  const id = item.agentId;
  return {
    type: "agent",
    id,
    title: item.name ?? `Agent ${id}`,
    subtitle: `Agent ${id}`,
    route: `/agents/${id}`,
  };
}

function legacySearchResults(record: Record<string, unknown>): unknown[] {
  const type = toStringValue(record.type);

  if (type === "agent") {
    const agentId = toStringValue(record.agentId);
    return [
      {
        type: "agent",
        id: agentId,
        title: `Agent ${agentId}`,
        subtitle: "Direct agent match",
        route: `/agents/${agentId}`,
      },
    ];
  }

  if (type === "address") {
    const address = toStringValue(record.address);
    return [
      {
        type: "address",
        id: address,
        title: address,
        subtitle: `${toNumberValue(record.transactionCount)} related transactions`,
        route: `/address/${address}`,
      },
    ];
  }

  if (type === "transaction") {
    const txHash = toStringValue(record.txHash);
    return [
      {
        type: "transaction",
        id: txHash,
        title: txHash,
        subtitle: "Direct transaction match",
        route: `/tx/${txHash}`,
      },
    ];
  }

  if (type === "tag_search") {
    const rows = toRecordArray(record.results);
    return rows.map((row, index) => ({
      type: "tag",
      id: `tag:${index}`,
      title: toStringValue(asRecord(row.eventArgs).tag1 || asRecord(row.eventArgs).tag2 || "Tag match"),
      subtitle: "Feedback tag match",
      route: "/reputation",
    }));
  }

  return [];
}

function parseErrorPayload(statusCode: number, payload: unknown): ApiErrorPayload {
  const record = asRecord(payload);
  const errorRecord = asRecord(record.error);

  return {
    message: toStringValue(errorRecord.message ?? record.message, `Request failed (${statusCode})`),
    statusCode,
    details: isRecord(errorRecord.details) ? errorRecord.details : undefined,
  };
}

function isQueryValue(value: unknown): value is QueryValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  );
}

function toQueryRecord<T extends object>(params: T): Record<string, QueryValue> {
  const out: Record<string, QueryValue> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (isQueryValue(value) && value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  });

  return out;
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  public constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
    this.statusCode = payload.statusCode;
    this.details = payload.details;
  }
}

export class ScannerApiClient {
  private readonly baseUrl: string;

  private readonly fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  public constructor(baseUrl: string, fetchImpl?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const resolvedFetch = fetchImpl ?? globalThis.fetch;
    this.fetchImpl = (input, init) => resolvedFetch.call(globalThis, input, init);
  }

  public static fromEnv(fetchImpl?: typeof fetch): ScannerApiClient {
    const baseUrl = import.meta.env.PUBLIC_SCANNER_API_BASE_URL ?? "http://localhost:3000";
    return new ScannerApiClient(baseUrl, fetchImpl);
  }

  public async getHealth(): Promise<HealthResponse> {
    return this.request("/v1/health", undefined, parseHealthResponse);
  }

  public async getAgents(params: AgentListQuery = {}): Promise<PaginatedResult<AgentSummary>> {
    return this.request(
      "/v1/agents",
      toQueryRecord(params),
      (payload) => parsePaginated(payload, parseAgentSummary),
    );
  }

  public async getAgent(agentId: string): Promise<AgentProfileResponse> {
    return this.request(`/v1/agents/${agentId}`, undefined, parseAgentProfileResponse);
  }

  public async getReputation(params: ReputationListQuery = {}): Promise<ReputationResponse> {
    return this.request("/v1/reputation", toQueryRecord(params), parseReputationResponse);
  }

  public async getAgentReputation(agentId: string): Promise<ReputationResponse> {
    return this.request(`/v1/reputation/${agentId}`, undefined, parseReputationResponse);
  }

  public async getAddress(address: string): Promise<AddressProfileResponse> {
    return this.request(`/v1/address/${address}`, undefined, parseAddressProfileResponse);
  }

  public async getTransaction(txHash: string): Promise<TransactionDetailResponse> {
    return this.request(`/v1/transactions/${txHash}`, undefined, parseTransactionDetailResponse);
  }

  public async getAnalyticsOverview(): Promise<AnalyticsOverviewResponse> {
    return this.request("/v1/analytics/overview", undefined, parseAnalyticsOverviewResponse);
  }

  public async getNetworkGraph(params: NetworkGraphQuery = {}): Promise<NetworkGraphResponse> {
    return this.request("/v1/network/graph", toQueryRecord(params), parseNetworkGraphResponse);
  }

  public async searchAgents(params: AgentMetadataSearchQuery): Promise<AgentMetadataSearchResponse> {
    return this.request("/v1/search/agents", toQueryRecord(params), parseAgentMetadataSearchResponse);
  }

  public async search(params: SearchQuery): Promise<SearchResponse> {
    try {
      const metadataResponse = await this.searchAgents({
        ...params,
        status: "resolved",
      });
      if (metadataResponse.results.items.length > 0) {
        return {
          query: metadataResponse.query,
          results: {
            items: metadataResponse.results.items.map((item) => toSearchResultFromMetadataItem(item)),
            meta: metadataResponse.results.meta,
          },
        };
      }
    } catch {
      // Fall back to legacy mixed-entity search when metadata search is unavailable.
    }

    return this.request("/v1/search", toQueryRecord(params), parseSearchResponse);
  }

  /**
   * Build an absolute URL for the image proxy endpoint.
   * Returns null for data: URIs (render directly) or empty input.
   */
  public imageProxyUrl(imageUri: string): string | null {
    if (!imageUri || imageUri.startsWith("data:")) return null;
    return `${this.baseUrl}/v1/resolve/image?url=${encodeURIComponent(imageUri)}`;
  }

  public async resolveUri(url: string): Promise<ResolveUriResponse> {
    return this.request("/v1/resolve/uri", { url }, (payload) => {
      const record = asRecord(payload);
      return {
        contentType: toStringValue(record.contentType, "text/plain"),
        body: record.body ?? null,
      };
    });
  }

  private async request<T>(
    path: string,
    params: Record<string, QueryValue> | undefined,
    parser: (payload: unknown) => T,
  ): Promise<T> {
    const query = params ? buildQueryString(params) : "";
    const response = await this.fetchImpl(`${this.baseUrl}${path}${query}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const parsedBody = await this.safeJsonParse(response);

    if (!response.ok) {
      throw new ApiClientError(parseErrorPayload(response.status, parsedBody));
    }

    return parser(unwrapEnvelope(parsedBody));
  }

  private async safeJsonParse(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
}
