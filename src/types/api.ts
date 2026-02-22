export type DataStatus = "loading" | "error" | "empty" | "ready";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export type AgentSort =
  | "newest"
  | "oldest"
  | "most-feedback"
  | "highest-reputation"
  | "recently-active";

export interface AgentListQuery {
  page?: number;
  limit?: number;
  sort?: AgentSort;
  hasFeedback?: boolean;
  registeredSinceDays?: number;
  tag?: string;
  x402Support?: boolean;
  protocol?: "a2a" | "mcp" | "oasf" | "web";
  hasBeenTransferred?: boolean;
  hasResponses?: boolean;
  chainId?: number;
}

export interface ReputationListQuery {
  page?: number;
  limit?: number;
  tag?: string;
  endpoint?: string;
  chainId?: number;
}

export interface NetworkGraphQuery {
  chainId?: number;
  minWeight?: number;
  since?: number;
  until?: number;
  limit?: number;
  agentId?: string;
  address?: string;
}

export interface SearchQuery {
  q: string;
  page?: number;
  limit?: number;
  chainId?: number;
}

export type AgentMetadataSearchStatus = "resolved" | "failed" | "pending" | "all";

export interface AgentMetadataSearchQuery extends SearchQuery {
  status?: AgentMetadataSearchStatus;
  x402Support?: boolean;
  active?: boolean;
  includeRaw?: boolean;
}

export interface AgentSummary {
  chainId: number;
  agentId: string;
  ownerAddress: string;
  originalRegistrant: string;
  agentUri: string;
  name: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  services: string[];
  x402Support: boolean;
  type: string | null;
  active: boolean | null;
  erc8004Support: boolean | null;
  registrations: string[];
  supportedTrusts: string[];
  registrationTxHash: string;
  registrationTimestamp: number;
  hasBeenTransferred: boolean;
  transferCount: number;
  feedbackCount: number;
  responseCount: number;
  averageReputation: number | null;
  lastActiveTimestamp: number | null;
}

export interface AgentHeuristics {
  reputationScore: number | null;
  clientDiversity: number | null;
  revocationRate: number | null;
  responseRate: number | null;
  recencyBiasDays: number | null;
  timeToFirstFeedbackDays: number | null;
  averageRevocationLatencyHours: number | null;
  averageResponseLatencyHours: number | null;
  integrityPassRate: number | null;
  feedbackBurstRatio30d: number | null;
  reciprocalReviewRatio: number | null;
  closedClusterRatio: number | null;
  connectedBuilderCount: number;
}

export interface FeedbackEntry {
  feedbackId: string;
  agentId: string;
  clientAddress: string;
  feedbackIndex: number;
  value: number;
  valueDecimals: number;
  normalizedValue: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackUri: string;
  feedbackHash: string;
  integrity: "pass" | "fail" | "unknown";
  revoked: boolean;
  revokedAt: number | null;
  responseCount: number;
  timestamp: number;
  txHash: string;
}

export interface ResponseEntry {
  responseId: string;
  agentId: string;
  clientAddress: string;
  feedbackIndex: number;
  responder: string;
  responseUri: string;
  responseHash: string;
  integrity: "pass" | "fail" | "unknown";
  timestamp: number;
  txHash: string;
}

export interface OwnershipEvent {
  fromAddress: string;
  toAddress: string;
  eventType: "mint" | "transfer";
  timestamp: number;
  txHash: string;
}

export interface UriHistoryEntry {
  uri: string;
  updatedBy: string;
  timestamp: number;
  txHash: string;
}

export interface MetadataHistoryEntry {
  key: string;
  value: string;
  currentValue: string;
  timestamp: number;
  txHash: string;
}

export interface AgentTransactionEntry {
  eventName: string;
  txHash: string;
  timestamp: number;
  summary: string;
}

export interface TrustMetrics {
  reciprocalReviewRatio: number | null;
  closedClusterRatio: number | null;
  connectedBuilderCount: number;
}

export interface AgentProfileResponse {
  agent: AgentSummary;
  resolvedMetadata: ResolvedAgentMetadata | null;
  payoutWallet: string | null;
  currentUri: string;
  reputationSummary: {
    count: number;
    summaryValue: number;
    summaryValueDecimals: number;
  };
  feedback: PaginatedResult<FeedbackEntry>;
  responses: PaginatedResult<ResponseEntry>;
  ownershipHistory: OwnershipEvent[];
  uriHistory: UriHistoryEntry[];
  metadataHistory: MetadataHistoryEntry[];
  transactionHistory: AgentTransactionEntry[];
  trustNetwork: NetworkGraphResponse;
  trustMetrics: TrustMetrics;
  heuristics: AgentHeuristics;
}

export interface ReputationMetrics {
  totalFeedbackEntries: number;
  totalRevocations: number;
  totalResponsesAppended: number;
  uniqueAgentsWithFeedback: number;
  uniqueClients: number;
  uniqueResponders: number;
  mostActiveClient: string | null;
  mostReviewedAgent: string | null;
  mostActiveResponder: string | null;
}

export interface ReputationHeuristics {
  feedbackVelocity: number | null;
  responderDiversity: number | null;
  integrityFailureRate: number | null;
  sybilSuspicionAgents: string[];
  tagDistribution: Record<string, number>;
  endpointPopularity: Record<string, number>;
}

export interface ReputationResponse {
  metrics: ReputationMetrics;
  heuristics: ReputationHeuristics;
  recentFeedback: PaginatedResult<FeedbackEntry>;
  recentResponses: PaginatedResult<ResponseEntry>;
  agentNames: Record<string, string>;
}

export interface AddressOwnerSection {
  agentsCurrentlyOwned: string[];
  agentsOriginallyRegistered: string[];
  agentsTransferredAway: string[];
  agentsReceivedViaTransfer: string[];
}

export interface AddressClientSection {
  feedback: PaginatedResult<FeedbackEntry>;
  agentsReviewed: string[];
  revocationCount: number;
  averageScoreGiven: number | null;
  feedbackIntegrityRate: number | null;
}

export interface AddressResponderSection {
  responses: PaginatedResult<ResponseEntry>;
  agentsRespondedTo: string[];
  responseCount: number;
  averageResponseLatencyHours: number | null;
}

export interface AddressProfileResponse {
  address: string;
  owner: AddressOwnerSection;
  feedbackClient: AddressClientSection;
  responder: AddressResponderSection;
  payoutWalletAgentIds: string[];
  uriUpdateCount: number;
}

export interface TransactionEnvelope {
  txHash: string;
  chainId: number;
  registryAddress: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  timestamp: number;
  status: "success";
  from: string;
  to: string;
  nonce: number;
  value: string;
  gas: string;
  gasUsed: string;
  gasPrice: string;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  cumulativeGasUsed: string;
}

export interface CallFact {
  functionName: string;
  functionSignature: string;
  rawArgs: Record<string, unknown>;
  normalizedArgs: Record<string, unknown>;
}

export interface EventFact {
  logIndex: number;
  topic0: string;
  topics: string[];
  data: string;
  eventName: string;
  eventSignature: string;
  eventArgs: Record<string, unknown>;
  timestamp: number;
  txHash: string;
}

export interface TransactionDetailResponse {
  transactionFact: TransactionEnvelope;
  callFact: CallFact;
  eventFacts: EventFact[];
  relatedAgents: Array<{
    agentId: string;
    name: string;
    imageUrl: string | null;
  }>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
}

export interface WindowedValue {
  d24h: number | null;
  d7d: number | null;
  d30d: number | null;
}

export interface WindowedHeuristics {
  ecosystemGrowthVelocity: WindowedValue;
  feedbackDensity: WindowedValue;
  dormantAgentRatio: WindowedValue;
  responseEngagementRate: WindowedValue;
  transferRate: WindowedValue;
}

export interface TopAgentSummary {
  agentId: string;
  value: number;
  agentUri: string;
  name: string | null;
  imageUrl: string | null;
  reputationScore: number | null;
  clientDiversity: number | null;
}

export interface DashboardActivityItem {
  chainId: number;
  eventName: string;
  agentId: string | null;
  agentName: string | null;
  agentImageUrl: string | null;
  txHash: string;
  logIndex: number;
  timestamp: number;
  summary: string;
}

export type DashboardActivityStreamMessage =
  | { type: "connected"; timestamp: number }
  | { type: "activity"; item: DashboardActivityItem };

export interface ResolvedAgentMetadata {
  links: ResolvedMetadataLink[];
  name: string | null;
  description: string | null;
  type: string | null;
  image: string | null;
  active: boolean | null;
  x402Support: boolean | null;
  erc8004Support: boolean | null;
  services: string[];
  registrations: string[];
  supportedTrusts: string[];
  resolveStatus: "resolved" | "failed" | "pending";
  resolvedAt: number;
}

export interface ResolvedMetadataLink {
  kind: "web" | "email" | "twitter";
  label: string;
  href: string;
  endpoint: string;
  serviceName: string | null;
}

export interface AnalyticsOverviewResponse {
  dashboardMetrics: {
    totalRegisteredAgents: number;
    newAgents24h: number;
    newAgents7d: number;
    newAgents30d: number;
    totalFeedbackSubmitted: number;
    activeFeedback: number;
    uniqueClientAddresses: number;
    totalResponsesAppended: number;
    agentTransfers: number;
  };
  heuristics: {
    ecosystemGrowthVelocity: number | null;
    feedbackDensity: number | null;
    revocationRate: number | null;
    dormantAgentRatio: number | null;
    responseEngagementRate: number | null;
    transferRate: number | null;
    networkGiniCoefficient: number | null;
    responderConcentration: number | null;
  };
  windowedHeuristics: WindowedHeuristics;
  charts: {
    registrations: TimeSeriesPoint[];
    feedbackVolume: TimeSeriesPoint[];
    responseVolume: TimeSeriesPoint[];
    revocationVolume: TimeSeriesPoint[];
    activeAgents: TimeSeriesPoint[];
    clientGrowth: TimeSeriesPoint[];
    responderGrowth: TimeSeriesPoint[];
    transferVolume: TimeSeriesPoint[];
    integrityHealth: TimeSeriesPoint[];
    topAgentsByFeedback: TopAgentSummary[];
    tagHeatmap: HeatmapCell[];
    endpointHeatmap: HeatmapCell[];
    protocolDistribution: Array<{ label: string; value: number }>;
    timeToFirstFeedbackDistribution: Array<{ label: string; value: number }>;
    selectedAgentFeedbackVelocity: TimeSeriesPoint[];
  };
  activityFeed: DashboardActivityItem[];
}

export interface NetworkNodeInput {
  id?: string;
  chainId?: number;
  agentId?: string;
  address?: string;
  kind?: "agent" | "address" | "feedback";
  name?: string;
  meta?: Record<string, unknown>;
}

export interface NetworkEdgeInput {
  id?: string;
  source: string;
  target: string;
  kind: "review" | "registrant" | "agent-review" | "response";
  weight?: number;
  firstSeen?: number;
  lastSeen?: number;
  txHash?: string;
}

export interface NetworkGraphResponse {
  nodes: NetworkNodeInput[];
  edges: NetworkEdgeInput[];
  metrics: {
    reciprocalReviewRatioGlobal: number | null;
    isolatedClusterShare: number | null;
    networkBridgeCount: number;
  };
  meta: {
    edgeLimitApplied: number;
    truncated: boolean;
  };
}

export interface SearchResultItem {
  type: "agent" | "address" | "transaction" | "tag" | "endpoint";
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export interface SearchResponse {
  query: string;
  results: PaginatedResult<SearchResultItem>;
}

export interface AgentMetadataSearchItem {
  chainId: number;
  agentId: string;
  uri: string;
  name: string | null;
  description: string | null;
  type: string | null;
  image: string | null;
  active: boolean | null;
  x402Support: boolean | null;
  erc8004Support: boolean | null;
  services: string[];
  registrations: string[];
  supportedTrusts: string[];
  resolveStatus: "resolved" | "failed" | "pending";
  resolvedAt: number;
}

export interface AgentMetadataSearchResponse {
  query: string;
  filters: Record<string, unknown>;
  results: PaginatedResult<AgentMetadataSearchItem>;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  chainId: number;
  latestSyncedBlock: number;
  updatedAt: number;
}

export interface ApiErrorPayload {
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export interface ResolveUriResponse {
  contentType: string;
  body: unknown;
}
