import type {
  AddressProfileResponse,
  AgentProfileResponse,
  ReputationResponse,
  TransactionDetailResponse,
} from "../types/api";
import { normalizeAddressParam, normalizeAgentIdParam, normalizeTxHashParam } from "./query";

interface RouteClient {
  getAgent(agentId: string): Promise<AgentProfileResponse>;
  getAgentReputation(agentId: string): Promise<ReputationResponse>;
  getAddress(address: string): Promise<AddressProfileResponse>;
  getTransaction(txHash: string): Promise<TransactionDetailResponse>;
}

export async function loadAgentProfileForRoute(
  client: RouteClient,
  agentIdParam: string,
): Promise<AgentProfileResponse> {
  const agentId = normalizeAgentIdParam(agentIdParam);
  return client.getAgent(agentId);
}

export async function loadAgentReputationForRoute(
  client: RouteClient,
  agentIdParam: string,
): Promise<ReputationResponse> {
  const agentId = normalizeAgentIdParam(agentIdParam);
  return client.getAgentReputation(agentId);
}

export async function loadAddressProfileForRoute(
  client: RouteClient,
  addressParam: string,
): Promise<AddressProfileResponse> {
  const address = normalizeAddressParam(addressParam);
  return client.getAddress(address);
}

export async function loadTransactionForRoute(
  client: RouteClient,
  txHashParam: string,
): Promise<TransactionDetailResponse> {
  const txHash = normalizeTxHashParam(txHashParam);
  return client.getTransaction(txHash);
}
