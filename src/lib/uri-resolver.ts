/**
 * URI scheme classification and data resolution for ERC-8004 agent URIs.
 */

export type UriScheme = "data-json" | "data-other" | "http" | "ipfs" | "unknown";

export interface ResolvedUri {
  scheme: UriScheme;
  /** The original raw URI string */
  raw: string;
  /** Decoded content (JSON object for data URIs, null for unresolved schemes) */
  decoded: unknown | null;
  /** Human-readable error if decoding failed */
  error: string | null;
}

const DATA_URI_RE = /^data:([^;,]+)(?:;([^,]+))?,(.*)$/;

function parseDataUriEncoding(raw: string): { base64: boolean; gzip: boolean } {
  const parts = raw.split(";");
  return {
    base64: parts.includes("base64"),
    gzip: parts.some((p) => p === "enc=gzip" || p === "gzip"),
  };
}

/**
 * Classify and attempt to decode an agent URI.
 *
 * Supported:
 * - `data:application/json;base64,<payload>` => decoded JSON object
 * - `data:application/json,<payload>` => decoded JSON object (URL-encoded or plain)
 * - `data:application/json;enc=gzip;base64,<payload>` => needs async (use resolveDataUriAsync)
 * - `http://` / `https://` => classified but not fetched (scheme: "http")
 * - `ipfs://` => classified but not resolved (scheme: "ipfs")
 *
 * When the return has scheme "data-json" with decoded === null and error === null,
 * the URI requires async decompression — call resolveDataUriAsync().
 */
export function resolveAgentUri(uri: string | null | undefined): ResolvedUri {
  if (!uri || uri.trim().length === 0) {
    return { scheme: "unknown", raw: uri ?? "", decoded: null, error: null };
  }

  const trimmed = uri.trim();

  // --- IPFS URIs ---
  if (trimmed.startsWith("ipfs://")) {
    return { scheme: "ipfs", raw: trimmed, decoded: null, error: null };
  }

  // --- HTTP(S) URIs ---
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { scheme: "http", raw: trimmed, decoded: null, error: null };
  }

  // --- Raw JSON ---
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return { scheme: "data-json", raw: trimmed, decoded: parsed, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown parse error";
      return { scheme: "data-json", raw: trimmed, decoded: null, error: `Failed to parse JSON: ${message}` };
    }
  }

  // --- Data URIs ---
  const dataMatch = trimmed.match(DATA_URI_RE);
  if (dataMatch) {
    const mimeType = dataMatch[1] ?? "";
    const encodingRaw = dataMatch[2] ?? "";
    const payload = dataMatch[3] ?? "";

    const isJson = mimeType === "application/json" || mimeType.endsWith("+json");

    if (!isJson) {
      return { scheme: "data-other", raw: trimmed, decoded: null, error: null };
    }

    const enc = parseDataUriEncoding(encodingRaw);

    // Gzip requires async decompression — signal caller to use resolveDataUriAsync()
    if (enc.gzip) {
      return { scheme: "data-json", raw: trimmed, decoded: null, error: null };
    }

    try {
      let jsonString: string;
      if (enc.base64) {
        const binaryString = atob(payload);
        const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
        jsonString = new TextDecoder().decode(bytes);
      } else {
        // Plain or URL-encoded
        jsonString = decodeURIComponent(payload);
      }

      const parsed: unknown = JSON.parse(jsonString);
      return { scheme: "data-json", raw: trimmed, decoded: parsed, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown decode error";
      return { scheme: "data-json", raw: trimmed, decoded: null, error: `Failed to decode data URI: ${message}` };
    }
  }

  return { scheme: "unknown", raw: trimmed, decoded: null, error: null };
}

/**
 * Returns true when resolveAgentUri returned an unresolved data URI
 * that requires async decompression (gzip).
 */
export function needsAsyncDataResolve(result: ResolvedUri): boolean {
  return result.scheme === "data-json" && result.decoded === null && result.error === null;
}

/**
 * Async resolver for gzip-compressed data URIs.
 * Uses the browser DecompressionStream API.
 */
export async function resolveDataUriAsync(uri: string): Promise<ResolvedUri> {
  const dataMatch = uri.match(DATA_URI_RE);
  if (!dataMatch) {
    return { scheme: "data-json", raw: uri, decoded: null, error: "Invalid data URI" };
  }

  const encodingRaw = dataMatch[2] ?? "";
  const payload = dataMatch[3] ?? "";
  const enc = parseDataUriEncoding(encodingRaw);

  try {
    let bytes: Uint8Array;
    if (enc.base64) {
      const binary = atob(payload);
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }

    if (enc.gzip) {
      const ds = new DecompressionStream("gzip");
      const blob = new Blob([bytes.buffer as ArrayBuffer]);
      const jsonString = await new Response(blob.stream().pipeThrough(ds)).text();
      const parsed: unknown = JSON.parse(jsonString);
      return { scheme: "data-json", raw: uri, decoded: parsed, error: null };
    }

    const jsonString = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(jsonString);
    return { scheme: "data-json", raw: uri, decoded: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown decode error";
    return { scheme: "data-json", raw: uri, decoded: null, error: `Failed to decode data URI: ${message}` };
  }
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetch an HTTP(S) URI and attempt to parse the response as JSON.
 *
 * Returns a ResolvedUri with `decoded` populated on success, or `error` set on failure.
 * Handles network errors, non-OK status codes, non-JSON responses, and timeouts.
 */
export async function fetchHttpUri(url: string): Promise<ResolvedUri> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return { scheme: "http", raw: url, decoded: null, error: `HTTP ${response.status} ${response.statusText}` };
    }

    const text = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { scheme: "http", raw: url, decoded: null, error: "Response is not valid JSON" };
    }

    return { scheme: "http", raw: url, decoded: parsed, error: null };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { scheme: "http", raw: url, decoded: null, error: "Request timed out" };
    }

    const message = err instanceof Error ? err.message : "Unknown fetch error";
    return { scheme: "http", raw: url, decoded: null, error: `Fetch failed: ${message}` };
  }
}
