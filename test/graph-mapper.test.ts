import { describe, expect, it } from "vitest";
import { createAddressNodeId, createAgentNodeId, mapNetworkGraphToVNetworkGraph } from "../src/lib/graph-mapper";
import type { NetworkGraphResponse } from "../src/types/api";

describe("graph mapper", () => {
  it("maps backend graph payload to stable node and edge ids", () => {
    const payload: NetworkGraphResponse = {
      nodes: [
        { kind: "agent", chainId: 1, agentId: "7", name: "Agent 7" },
        { kind: "address", address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", name: "USDC Wallet" },
      ],
      edges: [
        {
          source: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          target: "7",
          kind: "review",
          weight: 4,
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        },
      ],
      metrics: {
        reciprocalReviewRatioGlobal: 0.1,
        isolatedClusterShare: 0.2,
        networkBridgeCount: 3,
      },
      meta: {
        edgeLimitApplied: 250,
        truncated: false,
      },
    };

    const mapped = mapNetworkGraphToVNetworkGraph(payload);

    const agentNodeId = createAgentNodeId(1, "7");
    const addressNodeId = createAddressNodeId("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

    expect(mapped.nodes[agentNodeId]?.kind).toBe("agent");
    expect(mapped.nodes[addressNodeId]?.kind).toBe("address");

    const edgeIds = Object.keys(mapped.edges);
    expect(edgeIds).toHaveLength(1);

    const firstEdgeId = edgeIds[0];
    expect(firstEdgeId).toBeDefined();

    const mappedEdge = firstEdgeId ? mapped.edges[firstEdgeId] : undefined;
    expect(mappedEdge?.source).toBe(addressNodeId);
    expect(mappedEdge?.target).toBe(agentNodeId);
    expect(mapped.edgeRows[0]?.id).toContain("review:");
  });

  it("materializes placeholder nodes when edge references missing nodes", () => {
    const payload: NetworkGraphResponse = {
      nodes: [],
      edges: [
        {
          source: "0x1111111111111111111111111111111111111111",
          target: "42",
          kind: "agent-review",
        },
      ],
      metrics: {
        reciprocalReviewRatioGlobal: null,
        isolatedClusterShare: null,
        networkBridgeCount: 0,
      },
      meta: {
        edgeLimitApplied: 250,
        truncated: false,
      },
    };

    const mapped = mapNetworkGraphToVNetworkGraph(payload);

    const sourceId = createAddressNodeId("0x1111111111111111111111111111111111111111");
    const targetId = createAgentNodeId(1, "42");

    expect(mapped.nodes[sourceId]).toBeDefined();
    expect(mapped.nodes[targetId]).toBeDefined();
    expect(mapped.edgeRows).toHaveLength(1);
  });
});
