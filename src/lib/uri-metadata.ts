/**
 * Typed extraction of agent metadata from decoded URI JSON.
 */

export interface AgentUriMetadata {
  name: string | null;
  description: string | null;
  type: string | null;
  image: string | null;
  active: boolean | null;
  x402Support: boolean | null;
  erc8004Support: boolean | null;
  services: string[] | null;
  registrations: string[] | null;
  supportedTrusts: string[] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NULL_RESULT: AgentUriMetadata = {
  name: null,
  description: null,
  type: null,
  image: null,
  active: null,
  x402Support: null,
  erc8004Support: null,
  services: null,
  registrations: null,
  supportedTrusts: null,
};

/**
 * Defensively extract known metadata fields from a decoded agent URI JSON payload.
 * Returns null for any field not present or not matching the expected type.
 *
 * Normalization:
 * - `x402Support` and `x402support` (lowercase) are merged; canonical casing preferred.
 * - `supportedTrust` (single string or array) is normalized and merged with `supportedTrusts`.
 * - `8004Support` is mapped to `erc8004Support` (JS identifiers cannot start with a digit).
 */
export function extractAgentUriMetadata(decoded: unknown): AgentUriMetadata {
  if (!isRecord(decoded)) {
    return NULL_RESULT;
  }

  const name = typeof decoded.name === "string" && decoded.name.length > 0 ? decoded.name : null;

  const description =
    typeof decoded.description === "string" && decoded.description.length > 0
      ? decoded.description
      : null;

  const type = typeof decoded.type === "string" && decoded.type.length > 0 ? decoded.type : null;

  const image = typeof decoded.image === "string" && decoded.image.length > 0 ? decoded.image : null;

  const active = typeof decoded.active === "boolean" ? decoded.active : null;

  // Merge x402Support (canonical) with x402support (lowercase variant)
  const rawX402Upper = decoded.x402Support;
  const rawX402Lower = decoded["x402support"];
  const x402Support =
    typeof rawX402Upper === "boolean"
      ? rawX402Upper
      : typeof rawX402Lower === "boolean"
        ? rawX402Lower
        : null;

  // 8004Support — bracket access required (numeric-leading key)
  const raw8004 = decoded["8004Support"];
  const erc8004Support = typeof raw8004 === "boolean" ? raw8004 : null;

  const services = Array.isArray(decoded.services)
    ? decoded.services.filter((s): s is string => typeof s === "string")
    : null;

  const registrations = Array.isArray(decoded.registrations)
    ? decoded.registrations.filter((s): s is string => typeof s === "string")
    : null;

  // Merge supportedTrusts (array) with supportedTrust (string or array)
  const rawTrusts = decoded.supportedTrusts;
  const rawTrust = decoded.supportedTrust;
  const arrayPart: string[] = Array.isArray(rawTrusts)
    ? rawTrusts.filter((s): s is string => typeof s === "string")
    : [];
  const fallbackPart: string[] =
    typeof rawTrust === "string" && rawTrust.length > 0
      ? [rawTrust]
      : Array.isArray(rawTrust)
        ? rawTrust.filter((s): s is string => typeof s === "string")
        : [];
  const supportedTrusts =
    arrayPart.length > 0 || fallbackPart.length > 0
      ? [...new Set([...arrayPart, ...fallbackPart])]
      : null;

  return {
    name,
    description,
    type,
    image,
    active,
    x402Support,
    erc8004Support,
    services,
    registrations,
    supportedTrusts,
  };
}
