import Graph from "graphology";
import type { Attributes } from "graphology-types";
import type { GraphEdgeRow, GraphNode } from "../types/graph";
import { EDGE_KIND_COLORS } from "../types/graph";

const NODE_KIND_COLORS: Record<GraphNode["kind"], string> = {
  agent: "#1D4ED8",
  address: "#0B5E67",
  feedback: "#64748B",
};

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

export interface SigmaNodeAttributes extends Attributes {
  id: string;
  kind: GraphNode["kind"];
  name: string;
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  agentId?: string;
  address?: string;
  meta?: Record<string, unknown>;
}

export interface SigmaEdgeAttributes extends Attributes {
  id: string;
  kind: GraphEdgeRow["kind"];
  color: string;
  size: number;
  weight: number;
  firstSeen?: number;
  lastSeen?: number;
  txHash?: string;
}

function toNodeLabel(node: GraphNode): string {
  if (node.kind === "address" && node.name.startsWith("0x") && node.name.length > 12) {
    return `${node.name.slice(0, 8)}...${node.name.slice(-4)}`;
  }

  if (node.kind === "feedback" && node.name.length > 18) {
    return `${node.name.slice(0, 15)}...`;
  }

  return node.name;
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

function toNodeSize(node: GraphNode): number {
  return node.kind === "agent" ? 9 : 6;
}

function toEdgeSize(weight: number): number {
  return Math.min(6, 1 + Math.log2(weight + 1));
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function seedNodePosition(nodeId: string, index: number): { x: number; y: number } {
  const hash = hashString(nodeId);
  const radialOffset = hash % 17;
  const angleOffset = (hash % 360) * (Math.PI / 180);
  const radius = 30 + Math.sqrt(index + 1) * 12 + radialOffset;
  const angle = index * GOLDEN_ANGLE_RAD + angleOffset;
  const x = Number((Math.cos(angle) * radius).toFixed(6));
  const y = Number((Math.sin(angle) * radius).toFixed(6));

  if (x === 0 && y === 0) {
    return { x: 1, y: 0 };
  }

  return { x, y };
}

function fallbackGraphNode(nodeId: string): GraphNode {
  const kind = inferNodeKindFromId(nodeId);

  if (kind === "agent") {
    const parts = nodeId.split(":");
    return {
      kind,
      name: parts[2] ? `Agent ${parts[2]}` : nodeId,
      chainId: parts[1] ? Number(parts[1]) : undefined,
      agentId: parts[2],
    };
  }

  if (kind === "address") {
    const address = nodeId.slice("address:".length);
    return {
      kind,
      name: address || nodeId,
      address: address || undefined,
    };
  }

  return {
    kind,
    name: nodeId,
  };
}

function toSigmaNodeAttributes(nodeId: string, node: GraphNode, index: number): SigmaNodeAttributes {
  const seeded = seedNodePosition(nodeId, index);

  return {
    id: nodeId,
    kind: node.kind,
    name: node.name,
    label: toNodeLabel(node),
    color: NODE_KIND_COLORS[node.kind] ?? NODE_KIND_COLORS.feedback,
    size: toNodeSize(node),
    x: seeded.x,
    y: seeded.y,
    agentId: node.agentId,
    address: node.address,
    meta: node.meta,
  };
}

function toSigmaEdgeAttributes(edgeId: string, edge: GraphEdgeRow): SigmaEdgeAttributes {
  const rawWeight = edge.weight;
  const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;

  return {
    id: edgeId,
    kind: edge.kind,
    color: EDGE_KIND_COLORS[edge.kind],
    size: toEdgeSize(weight),
    weight,
    firstSeen: edge.firstSeen,
    lastSeen: edge.lastSeen,
    txHash: edge.txHash,
  };
}

export function buildSigmaGraph(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdgeRow>,
): Graph<SigmaNodeAttributes, SigmaEdgeAttributes> {
  const graph = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const sortedNodeEntries = Object.entries(nodes).sort(([left], [right]) => left.localeCompare(right));

  sortedNodeEntries.forEach(([nodeId, node], index) => {
    graph.addNode(nodeId, toSigmaNodeAttributes(nodeId, node, index));
  });

  const sortedEdgeEntries = Object.entries(edges).sort(([left], [right]) => left.localeCompare(right));

  sortedEdgeEntries.forEach(([edgeId, edge]) => {
    if (!graph.hasNode(edge.source)) {
      const fallbackNode = fallbackGraphNode(edge.source);
      graph.addNode(edge.source, toSigmaNodeAttributes(edge.source, fallbackNode, graph.order));
    }

    if (!graph.hasNode(edge.target)) {
      const fallbackNode = fallbackGraphNode(edge.target);
      graph.addNode(edge.target, toSigmaNodeAttributes(edge.target, fallbackNode, graph.order));
    }

    graph.addDirectedEdgeWithKey(edgeId, edge.source, edge.target, toSigmaEdgeAttributes(edgeId, edge));
  });

  return graph;
}
