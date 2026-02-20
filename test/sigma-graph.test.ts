import { describe, expect, it } from "vitest";
import { buildSigmaGraph } from "../src/lib/sigma-graph";
import type { GraphEdgeRow, GraphNode } from "../src/types/graph";

describe("sigma graph projection", () => {
  it("projects graph nodes and edges with sigma attributes", () => {
    const agentNodeId = "agent:1:7";
    const addressNodeId = "address:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    const edgeId = `review:${addressNodeId}:${agentNodeId}:sample`;

    const nodes: Record<string, GraphNode> = {
      [agentNodeId]: {
        kind: "agent",
        name: "Agent 7",
        chainId: 1,
        agentId: "7",
      },
      [addressNodeId]: {
        kind: "address",
        name: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
    };

    const edges: Record<string, GraphEdgeRow> = {
      [edgeId]: {
        id: edgeId,
        source: addressNodeId,
        target: agentNodeId,
        kind: "review",
        weight: 4,
        firstSeen: 1_700_000_000,
        lastSeen: 1_700_000_100,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
    };

    const graph = buildSigmaGraph(nodes, edges);

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);

    const agentAttrs = graph.getNodeAttributes(agentNodeId);
    expect(agentAttrs.kind).toBe("agent");
    expect(agentAttrs.label).toBe("Agent 7");
    expect(typeof agentAttrs.x).toBe("number");
    expect(typeof agentAttrs.y).toBe("number");
    expect(agentAttrs.size).toBeGreaterThan(0);
    expect(agentAttrs.color).toBe("#1D4ED8");

    const edgeAttrs = graph.getEdgeAttributes(edgeId);
    expect(edgeAttrs.kind).toBe("review");
    expect(edgeAttrs.weight).toBe(4);
    expect(edgeAttrs.size).toBeGreaterThan(1);
    expect(edgeAttrs.color).toBe("#0B5E67");
  });

  it("is deterministic for identical input", () => {
    const nodes: Record<string, GraphNode> = {
      "agent:1:42": {
        kind: "agent",
        name: "Agent 42",
        chainId: 1,
        agentId: "42",
      },
      "address:0x1111111111111111111111111111111111111111": {
        kind: "address",
        name: "0x1111111111111111111111111111111111111111",
        address: "0x1111111111111111111111111111111111111111",
      },
    };

    const edges: Record<string, GraphEdgeRow> = {
      "registrant:address:0x1111111111111111111111111111111111111111:agent:1:42:test": {
        id: "registrant:address:0x1111111111111111111111111111111111111111:agent:1:42:test",
        source: "address:0x1111111111111111111111111111111111111111",
        target: "agent:1:42",
        kind: "registrant",
        weight: 2,
      },
    };

    const first = buildSigmaGraph(nodes, edges);
    const second = buildSigmaGraph(nodes, edges);

    const firstAttrs = first.getNodeAttributes("agent:1:42");
    const secondAttrs = second.getNodeAttributes("agent:1:42");

    expect(firstAttrs.x).toBe(secondAttrs.x);
    expect(firstAttrs.y).toBe(secondAttrs.y);
    expect(firstAttrs.label).toBe(secondAttrs.label);
  });

  it("creates fallback nodes when edges reference unseen ids", () => {
    const edgeId = "response:address:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:agent:1:88:test";
    const edges: Record<string, GraphEdgeRow> = {
      [edgeId]: {
        id: edgeId,
        source: "address:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "agent:1:88",
        kind: "response",
      },
    };

    const graph = buildSigmaGraph({}, edges);

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.hasNode("address:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(graph.hasNode("agent:1:88")).toBe(true);
  });
});

