import { describe, expect, it, vi } from "vitest";
import {
  loadAddressProfileForRoute,
  loadAgentProfileForRoute,
  loadAgentReputationForRoute,
  loadTransactionForRoute,
} from "../src/lib/route-loaders";
import type {
  AddressProfileResponse,
  AgentProfileResponse,
  ReputationResponse,
  TransactionDetailResponse,
} from "../src/types/api";

const mockAgentResponse: AgentProfileResponse = {
  agent: {
    chainId: 1,
    agentId: "7",
    ownerAddress: "0x0000000000000000000000000000000000000001",
    originalRegistrant: "0x0000000000000000000000000000000000000001",
    agentUri: "ipfs://cid",
    name: "Agent 7",
    description: "",
    imageUrl: null,
    tags: [],
    services: [],
    x402Support: false,
    type: null,
    active: null,
    erc8004Support: null,
    registrations: [],
    supportedTrusts: [],
    registrationTxHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    registrationTimestamp: 0,
    hasBeenTransferred: false,
    transferCount: 0,
    feedbackCount: 0,
    responseCount: 0,
    averageReputation: null,
    lastActiveTimestamp: null,
  },
  resolvedMetadata: null,
  payoutWallet: null,
  currentUri: "",
  reputationSummary: { count: 0, summaryValue: 0, summaryValueDecimals: 0 },
  feedback: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
  responses: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
  ownershipHistory: [],
  uriHistory: [],
  metadataHistory: [],
  transactionHistory: [],
  trustNetwork: {
    nodes: [],
    edges: [],
    metrics: { reciprocalReviewRatioGlobal: null, isolatedClusterShare: null, networkBridgeCount: 0 },
    meta: { edgeLimitApplied: 250, truncated: false },
  },
  trustMetrics: { reciprocalReviewRatio: null, closedClusterRatio: null, connectedBuilderCount: 0 },
  heuristics: {
    reputationScore: null,
    clientDiversity: null,
    revocationRate: null,
    responseRate: null,
    recencyBiasDays: null,
    timeToFirstFeedbackDays: null,
    averageRevocationLatencyHours: null,
    averageResponseLatencyHours: null,
    integrityPassRate: null,
    feedbackBurstRatio30d: null,
    reciprocalReviewRatio: null,
    closedClusterRatio: null,
    connectedBuilderCount: 0,
  },
};

const mockReputationResponse: ReputationResponse = {
  metrics: {
    totalFeedbackEntries: 0,
    totalRevocations: 0,
    totalResponsesAppended: 0,
    uniqueAgentsWithFeedback: 0,
    uniqueClients: 0,
    uniqueResponders: 0,
    mostActiveClient: null,
    mostReviewedAgent: null,
    mostActiveResponder: null,
  },
  heuristics: {
    feedbackVelocity: null,
    responderDiversity: null,
    integrityFailureRate: null,
    sybilSuspicionAgents: [],
    tagDistribution: {},
    endpointPopularity: {},
  },
  recentFeedback: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
  recentResponses: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
  agentNames: {},
};

const mockAddressResponse: AddressProfileResponse = {
  address: "0x0000000000000000000000000000000000000001",
  owner: {
    agentsCurrentlyOwned: [],
    agentsOriginallyRegistered: [],
    agentsTransferredAway: [],
    agentsReceivedViaTransfer: [],
  },
  feedbackClient: {
    feedback: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
    agentsReviewed: [],
    revocationCount: 0,
    averageScoreGiven: null,
    feedbackIntegrityRate: null,
  },
  responder: {
    responses: { items: [], meta: { page: 1, limit: 25, total: 0, hasNextPage: false } },
    agentsRespondedTo: [],
    responseCount: 0,
    averageResponseLatencyHours: null,
  },
  payoutWalletAgentIds: [],
  uriUpdateCount: 0,
};

const mockTxResponse: TransactionDetailResponse = {
  transactionFact: {
    txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    chainId: 1,
    registryAddress: "0x0000000000000000000000000000000000000002",
    blockNumber: 1,
    blockHash: "0x2",
    transactionIndex: 0,
    timestamp: 0,
    status: "success",
    from: "0x0",
    to: "0x1",
    nonce: 1,
    value: "0",
    gas: "0",
    gasUsed: "0",
    gasPrice: "0",
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    cumulativeGasUsed: "0",
  },
  callFact: {
    functionName: "register",
    functionSignature: "register(string)",
    rawArgs: {},
    normalizedArgs: {},
  },
  eventFacts: [],
  relatedAgents: [],
};

describe("route loaders", () => {
  it("normalizes params and calls matching endpoint", async () => {
    const client = {
      getAgent: vi.fn(async () => mockAgentResponse),
      getAgentReputation: vi.fn(async () => mockReputationResponse),
      getAddress: vi.fn(async () => mockAddressResponse),
      getTransaction: vi.fn(async () => mockTxResponse),
    };

    await loadAgentProfileForRoute(client, "7");
    await loadAgentReputationForRoute(client, "7");
    await loadAddressProfileForRoute(client, "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD");
    await loadTransactionForRoute(
      client,
      "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );

    expect(client.getAgent).toHaveBeenCalledWith("7");
    expect(client.getAgentReputation).toHaveBeenCalledWith("7");
    expect(client.getAddress).toHaveBeenCalledWith("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(client.getTransaction).toHaveBeenCalledWith(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("rejects invalid route parameters", async () => {
    const client = {
      getAgent: vi.fn(async () => mockAgentResponse),
      getAgentReputation: vi.fn(async () => mockReputationResponse),
      getAddress: vi.fn(async () => mockAddressResponse),
      getTransaction: vi.fn(async () => mockTxResponse),
    };

    await expect(loadAgentProfileForRoute(client, "abc")).rejects.toThrow("Invalid agentId");
    await expect(loadAddressProfileForRoute(client, "bad-address")).rejects.toThrow("Invalid address");
    await expect(loadTransactionForRoute(client, "0x123")).rejects.toThrow("Invalid txHash");
  });
});
