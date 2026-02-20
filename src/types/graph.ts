export interface GraphNode {
  name: string;
  kind: "agent" | "address" | "feedback";
  chainId?: number;
  agentId?: string;
  address?: string;
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "review" | "registrant" | "agent-review" | "response";
  weight?: number;
  firstSeen?: number;
  lastSeen?: number;
  txHash?: string;
}

export interface GraphEdgeRow extends GraphEdge {
  id: string;
}

export interface GraphMapResult {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
  edgeRows: GraphEdgeRow[];
}

export interface ForceLayoutOptions {
  gravity: number;
  scalingRatio: number;
  slowDown: number;
  barnesHutOptimize: boolean;
  barnesHutTheta: number;
  useEdgeWeights: boolean;
  edgeWeightInfluence: number;
  autoRescale: boolean;
  autoCenter: boolean;
  runtimeMs: number;
}

export const EDGE_KIND_COLORS: Record<GraphEdge["kind"], string> = {
  review: "#0B5E67",
  registrant: "#FF7A45",
  "agent-review": "#1D4ED8",
  response: "#0F766E",
};
