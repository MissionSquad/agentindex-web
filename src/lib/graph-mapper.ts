import type { NetworkEdgeInput, NetworkGraphResponse, NetworkNodeInput } from "../types/api";
import type { GraphEdge, GraphMapResult, GraphNode } from "../types/graph";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const AGENT_ID_RE = /^[0-9]+$/;

export function createAgentNodeId(chainId: number, agentId: string): string {
  return `agent:${chainId}:${agentId}`;
}

export function createAddressNodeId(address: string): string {
  return `address:${address.toLowerCase()}`;
}

function inferNodeKindFromId(nodeId: string): GraphNode["kind"] {
  if (nodeId.startsWith("agent:")) {
    return "agent";
  }

  if (nodeId.startsWith("address:")) {
    return "address";
  }

  return "feedback";
}

function parseAgentNodeId(nodeId: string): { chainId: number; agentId: string } | null {
  if (!nodeId.startsWith("agent:")) {
    return null;
  }

  const parts = nodeId.split(":");
  if (parts.length < 3) {
    return null;
  }

  const chainId = Number(parts[1]);
  const agentId = parts[2];
  if (!Number.isFinite(chainId) || !agentId) {
    return null;
  }

  return { chainId, agentId };
}

function parseAddressNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith("address:")) {
    return null;
  }

  const address = nodeId.slice("address:".length);
  return address.length > 0 ? address.toLowerCase() : null;
}

function resolveNodeId(node: NetworkNodeInput, fallbackIndex: number): string {
  if (node.kind === "agent" && node.agentId) {
    return createAgentNodeId(node.chainId ?? 1, node.agentId);
  }

  if (node.kind === "address" && node.address) {
    return createAddressNodeId(node.address);
  }

  if (node.id) {
    return node.id;
  }

  if (node.address) {
    return createAddressNodeId(node.address);
  }

  if (node.agentId) {
    return createAgentNodeId(node.chainId ?? 1, node.agentId);
  }

  return `feedback:node:${fallbackIndex}`;
}

function resolveEdgeNodeReference(value: string): string {
  const normalized = value.trim();

  if (normalized.startsWith("agent:") || normalized.startsWith("address:")) {
    return normalized;
  }

  if (ADDRESS_RE.test(normalized)) {
    return createAddressNodeId(normalized);
  }

  if (AGENT_ID_RE.test(normalized)) {
    return createAgentNodeId(1, normalized);
  }

  return normalized;
}

function createStableEdgeId(edge: GraphEdge): string {
  const hashOrBucket = edge.txHash ?? `${edge.firstSeen ?? 0}-${edge.lastSeen ?? 0}`;
  return `${edge.kind}:${edge.source}:${edge.target}:${hashOrBucket}`;
}

function toGraphNode(node: NetworkNodeInput, nodeId: string): GraphNode {
  const inferredKind = node.kind ?? inferNodeKindFromId(nodeId);
  const parsedAgent = parseAgentNodeId(nodeId);
  const parsedAddress = parseAddressNodeId(nodeId);

  if (inferredKind === "agent") {
    return {
      kind: "agent",
      name: node.name ?? node.agentId ?? nodeId,
      chainId: node.chainId ?? parsedAgent?.chainId,
      agentId: node.agentId ?? parsedAgent?.agentId,
      meta: node.meta,
    };
  }

  if (inferredKind === "address") {
    return {
      kind: "address",
      name: node.name ?? node.address ?? nodeId,
      address: node.address?.toLowerCase() ?? parsedAddress ?? undefined,
      meta: node.meta,
    };
  }

  return {
    kind: "feedback",
    name: node.name ?? nodeId,
    meta: node.meta,
  };
}

function normalizeEdge(edge: NetworkEdgeInput): GraphEdge {
  return {
    source: resolveEdgeNodeReference(edge.source),
    target: resolveEdgeNodeReference(edge.target),
    kind: edge.kind,
    weight: edge.weight,
    firstSeen: edge.firstSeen,
    lastSeen: edge.lastSeen,
    txHash: edge.txHash,
  };
}

function ensureNodeExists(nodes: Record<string, GraphNode>, nodeId: string): void {
  if (nodes[nodeId]) {
    return;
  }

  const kind = inferNodeKindFromId(nodeId);
  const parsedAgent = parseAgentNodeId(nodeId);
  const parsedAddress = parseAddressNodeId(nodeId);
  nodes[nodeId] = {
    kind,
    name: nodeId,
    chainId: parsedAgent?.chainId,
    agentId: parsedAgent?.agentId,
    address: parsedAddress ?? undefined,
  };
}

export function mapNetworkGraphToVNetworkGraph(payload: NetworkGraphResponse): GraphMapResult {
  const nodes: Record<string, GraphNode> = {};
  const edges: Record<string, GraphEdge> = {};

  payload.nodes.forEach((node, index) => {
    const nodeId = resolveNodeId(node, index);
    nodes[nodeId] = toGraphNode(node, nodeId);
  });

  payload.edges.forEach((rawEdge) => {
    const normalizedEdge = normalizeEdge(rawEdge);

    ensureNodeExists(nodes, normalizedEdge.source);
    ensureNodeExists(nodes, normalizedEdge.target);

    const edgeId = rawEdge.id ?? createStableEdgeId(normalizedEdge);
    edges[edgeId] = normalizedEdge;
  });

  const edgeRows = Object.entries(edges)
    .map(([id, edge]) => ({ id, ...edge }))
    .sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0));

  return {
    nodes,
    edges,
    edgeRows,
  };
}
