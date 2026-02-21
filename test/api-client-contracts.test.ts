import { describe, expect, it, vi } from "vitest";
import { ScannerApiClient } from "../src/lib/api-client";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createClientWithPayload(payload: unknown): ScannerApiClient {
  const fetchImpl = vi.fn(async () => jsonResponse(payload));
  return new ScannerApiClient("http://localhost:3100", fetchImpl as unknown as typeof fetch);
}

function createClientWithUrlResponder(
  responder: (url: string) => unknown | Promise<unknown>,
): ScannerApiClient {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return jsonResponse(await responder(url));
  });
  return new ScannerApiClient("http://localhost:3100", fetchImpl as unknown as typeof fetch);
}

describe("ScannerApiClient contract parsing", () => {
  it("parses top agent name/image fields from analytics overview", async () => {
    const payload = {
      dashboardMetrics: {
        totalRegisteredAgents: 1,
        newAgents24h: 0,
        newAgents7d: 0,
        newAgents30d: 0,
        totalFeedbackSubmitted: 1,
        activeFeedback: 1,
        uniqueClientAddresses: 1,
        totalResponsesAppended: 0,
        agentTransfers: 0,
      },
      heuristics: {
        ecosystemGrowthVelocity: null,
        feedbackDensity: null,
        revocationRate: null,
        dormantAgentRatio: null,
        responseEngagementRate: null,
        transferRate: null,
        networkGiniCoefficient: null,
        responderConcentration: null,
      },
      windowedHeuristics: {
        ecosystemGrowthVelocity: { d24h: null, d7d: null, d30d: null },
        feedbackDensity: { d24h: null, d7d: null, d30d: null },
        dormantAgentRatio: { d24h: null, d7d: null, d30d: null },
        responseEngagementRate: { d24h: null, d7d: null, d30d: null },
        transferRate: { d24h: null, d7d: null, d30d: null },
      },
      charts: {
        registrations: [],
        feedbackVolume: [],
        responseVolume: [],
        revocationVolume: [],
        activeAgents: [],
        clientGrowth: [],
        responderGrowth: [],
        transferVolume: [],
        integrityHealth: [],
        topAgentsByFeedback: [
          {
            agentId: "7",
            value: 12,
            agentUri: "ipfs://cid",
            name: "Seven",
            imageUrl: "https://example.com/agent-7.png",
            reputationScore: 0.8,
            clientDiversity: 0.5,
          },
        ],
        tagHeatmap: [],
        endpointHeatmap: [],
        protocolDistribution: [],
        timeToFirstFeedbackDistribution: [],
        selectedAgentFeedbackVelocity: [],
      },
      activityFeed: [],
    };

    const client = createClientWithPayload(payload);
    const response = await client.getAnalyticsOverview();
    const firstTopAgent = response.charts.topAgentsByFeedback[0];

    expect(firstTopAgent).toBeDefined();
    expect(firstTopAgent?.name).toBe("Seven");
    expect(firstTopAgent?.imageUrl).toBe("https://example.com/agent-7.png");
  });

  it("parses reputation agentNames map", async () => {
    const payload = {
      metrics: {
        totalFeedbackEntries: 1,
        totalRevocations: 0,
        totalResponsesAppended: 1,
        uniqueAgentsWithFeedback: 1,
        uniqueClients: 1,
        uniqueResponders: 1,
        mostActiveClient: null,
        mostReviewedAgent: "7",
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
      agentNames: { "7": "Seven", "8": 8 },
    };

    const client = createClientWithPayload(payload);
    const response = await client.getReputation();

    expect(response.agentNames).toEqual({ "7": "Seven" });
  });

  it("parses transaction relatedAgents enrichment", async () => {
    const payload = {
      transactionFact: {
        txHash: `0x${"a".repeat(64)}`,
        chainId: 1,
        registryAddress: "0x0000000000000000000000000000000000000001",
        blockNumber: 1,
        blockHash: "0x1",
        transactionIndex: 0,
        timestamp: 1,
        status: "success",
        from: "0x0000000000000000000000000000000000000002",
        to: "0x0000000000000000000000000000000000000003",
        nonce: 0,
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
      relatedAgents: [
        { agentId: "7", name: "Seven", imageUrl: "https://example.com/seven.png" },
      ],
    };

    const client = createClientWithPayload(payload);
    const response = await client.getTransaction(`0x${"a".repeat(64)}`);

    expect(response.relatedAgents).toHaveLength(1);
    expect(response.relatedAgents[0]).toEqual({
      agentId: "7",
      name: "Seven",
      imageUrl: "https://example.com/seven.png",
    });
  });

  it("parses resolvedMetadata in agent profile responses", async () => {
    const payload = {
      agent: {
        chainId: 1,
        agentId: "7",
        ownerAddress: "0x0000000000000000000000000000000000000001",
        originalRegistrant: "0x0000000000000000000000000000000000000001",
        agentUri: "ipfs://cid",
        name: "Seven",
        description: "Agent seven",
        imageUrl: null,
        tags: [],
        services: ["a2a"],
        x402Support: true,
        type: "agent",
        active: true,
        erc8004Support: true,
        registrations: ["a2a"],
        supportedTrusts: ["trust-a"],
        registrationTxHash: `0x${"b".repeat(64)}`,
        registrationTimestamp: 1,
        hasBeenTransferred: false,
        transferCount: 0,
        feedbackCount: 0,
        responseCount: 0,
        averageReputation: null,
        lastActiveTimestamp: null,
      },
      resolvedMetadata: {
        name: "Seven",
        description: "Resolved description",
        type: "agent",
        image: "https://example.com/seven.png",
        active: true,
        x402Support: true,
        erc8004Support: true,
        services: ["a2a"],
        registrations: ["a2a"],
        supportedTrusts: ["trust-a"],
        links: [
          {
            kind: "web",
            label: "example.com",
            href: "https://example.com",
            endpoint: "https://example.com",
            serviceName: "web",
          },
          {
            kind: "email",
            label: "contact@example.com",
            href: "mailto:contact@example.com",
            endpoint: "contact@example.com",
            serviceName: "email",
          },
          {
            kind: "web",
            label: "unsafe",
            href: "javascript:alert(1)",
            endpoint: "javascript:alert(1)",
            serviceName: "web",
          },
        ],
        resolveStatus: "resolved",
        resolvedAt: 1700000000000,
      },
      payoutWallet: null,
      currentUri: "ipfs://cid",
      reputationSummary: {
        count: 0,
        summaryValue: 0,
        summaryValueDecimals: 0,
      },
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
        meta: { edgeLimitApplied: 0, truncated: false },
      },
      trustMetrics: {
        reciprocalReviewRatio: null,
        closedClusterRatio: null,
        connectedBuilderCount: 0,
      },
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

    const client = createClientWithPayload(payload);
    const response = await client.getAgent("7");

    expect(response.resolvedMetadata?.name).toBe("Seven");
    expect(response.resolvedMetadata?.resolveStatus).toBe("resolved");
    expect(response.resolvedMetadata?.services).toEqual(["a2a"]);
    expect(response.resolvedMetadata?.links).toEqual([
      {
        kind: "web",
        label: "example.com",
        href: "https://example.com",
        endpoint: "https://example.com",
        serviceName: "web",
      },
      {
        kind: "email",
        label: "contact@example.com",
        href: "mailto:contact@example.com",
        endpoint: "contact@example.com",
        serviceName: "email",
      },
    ]);
  });

  it("search() prioritizes metadata search results when available", async () => {
    const client = createClientWithUrlResponder((url) => {
      if (url.includes("/v1/search/agents")) {
        return {
          query: "portfolio",
          filters: { status: "resolved" },
          results: {
            items: [
              {
                chainId: 1,
                agentId: 42,
                uri: "https://example.com/agent.json",
                name: "Portfolio Agent",
                resolveStatus: "resolved",
                resolvedAt: 1700000000000,
              },
            ],
            meta: {
              page: 1,
              limit: 25,
              total: 1,
              hasNextPage: false,
            },
          },
        };
      }

      return {
        query: "portfolio",
        results: {
          items: [
            {
              type: "tag",
              id: "tag:defi",
              title: "Tag: defi",
              subtitle: "Agent 7",
              route: "/reputation?tag=defi",
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            hasNextPage: false,
          },
        },
      };
    });

    const response = await client.search({ q: "portfolio" });

    expect(response.results.items).toHaveLength(1);
    expect(response.results.items[0]).toEqual({
      type: "agent",
      id: "42",
      title: "Portfolio Agent",
      subtitle: "Agent 42",
      route: "/agents/42",
    });
  });

  it("search() falls back to legacy /v1/search when metadata search returns no rows", async () => {
    const client = createClientWithUrlResponder((url) => {
      if (url.includes("/v1/search/agents")) {
        return {
          query: "defi",
          filters: { status: "resolved" },
          results: {
            items: [],
            meta: {
              page: 1,
              limit: 25,
              total: 0,
              hasNextPage: false,
            },
          },
        };
      }

      return {
        query: "defi",
        results: {
          items: [
            {
              type: "tag",
              id: "tag:defi",
              title: "Tag: defi",
              subtitle: "Agent 7",
              route: "/reputation?tag=defi",
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            hasNextPage: false,
          },
        },
      };
    });

    const response = await client.search({ q: "defi" });

    expect(response.results.items).toHaveLength(1);
    expect(response.results.items[0]?.type).toBe("tag");
    expect(response.results.items[0]?.route).toContain("/reputation");
  });
});
