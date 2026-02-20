const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const AGENT_ID_RE = /^[0-9]+$/;

export type QueryValue = string | number | boolean | null | undefined;

export function buildQueryString(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const encoded = query.toString();
  return encoded.length === 0 ? "" : `?${encoded}`;
}

export function isEthereumAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

export function isTransactionHash(value: string): boolean {
  return TX_HASH_RE.test(value.trim());
}

export function isAgentId(value: string): boolean {
  return AGENT_ID_RE.test(value.trim());
}

export function normalizeAgentIdParam(value: string): string {
  const normalized = value.trim();
  if (!isAgentId(normalized)) {
    throw new Error(`Invalid agentId route parameter: ${value}`);
  }

  return normalized;
}

export function normalizeAddressParam(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!isEthereumAddress(normalized)) {
    throw new Error(`Invalid address route parameter: ${value}`);
  }

  return normalized;
}

export function normalizeTxHashParam(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!isTransactionHash(normalized)) {
    throw new Error(`Invalid txHash route parameter: ${value}`);
  }

  return normalized;
}

export function classifySearchInput(value: string): "agent" | "address" | "transaction" | "text" {
  const normalized = value.trim();

  if (isAgentId(normalized)) {
    return "agent";
  }

  if (isEthereumAddress(normalized)) {
    return "address";
  }

  if (isTransactionHash(normalized)) {
    return "transaction";
  }

  return "text";
}
