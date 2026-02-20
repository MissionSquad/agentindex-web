import { describe, expect, it, vi } from "vitest";
import { resolveAgentUri, fetchHttpUri } from "../src/lib/uri-resolver";

describe("resolveAgentUri", () => {
  it("returns unknown for null", () => {
    const result = resolveAgentUri(null);
    expect(result.scheme).toBe("unknown");
    expect(result.decoded).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns unknown for empty string", () => {
    const result = resolveAgentUri("");
    expect(result.scheme).toBe("unknown");
    expect(result.decoded).toBeNull();
  });

  it("returns unknown for undefined", () => {
    const result = resolveAgentUri(undefined);
    expect(result.scheme).toBe("unknown");
    expect(result.decoded).toBeNull();
  });

  it("decodes base64 data:application/json URI", () => {
    const result = resolveAgentUri("data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9");
    expect(result.scheme).toBe("data-json");
    expect(result.decoded).toEqual({ name: "Test" });
    expect(result.error).toBeNull();
  });

  it("decodes URL-encoded data:application/json URI", () => {
    const result = resolveAgentUri("data:application/json,%7B%22name%22%3A%22Test%22%7D");
    expect(result.scheme).toBe("data-json");
    expect(result.decoded).toEqual({ name: "Test" });
    expect(result.error).toBeNull();
  });

  it("returns error for invalid base64 data URI", () => {
    const result = resolveAgentUri("data:application/json;base64,!!!invalid!!!");
    expect(result.scheme).toBe("data-json");
    expect(result.decoded).toBeNull();
    expect(result.error).toBeTypeOf("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("decodes base64 data URI with UTF-8 multi-byte characters", () => {
    // {"description":"smart quotes \u201c\u201d and em dash \u2014"}
    const json = '{"description":"smart quotes \u201c\u201d and em dash \u2014"}';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
    const result = resolveAgentUri(`data:application/json;base64,${base64}`);
    expect(result.scheme).toBe("data-json");
    expect(result.error).toBeNull();
    const decoded = result.decoded as Record<string, string>;
    expect(decoded.description).toBe("smart quotes \u201c\u201d and em dash \u2014");
  });

  it("classifies non-JSON data URI as data-other", () => {
    const result = resolveAgentUri("data:text/plain;base64,aGVsbG8=");
    expect(result.scheme).toBe("data-other");
    expect(result.decoded).toBeNull();
  });

  it("classifies https URL as http scheme", () => {
    const result = resolveAgentUri("https://example.com/agent.json");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toBeNull();
    expect(result.error).toBeNull();
  });

  it("classifies http URL as http scheme", () => {
    const result = resolveAgentUri("http://example.com/agent.json");
    expect(result.scheme).toBe("http");
  });

  it("classifies ipfs URI", () => {
    const result = resolveAgentUri("ipfs://QmSomeHash");
    expect(result.scheme).toBe("ipfs");
    expect(result.decoded).toBeNull();
    expect(result.error).toBeNull();
  });

  it("trims whitespace before classification", () => {
    const result = resolveAgentUri("  https://example.com/agent.json  ");
    expect(result.scheme).toBe("http");
    expect(result.raw).toBe("https://example.com/agent.json");
  });

  it("classifies unknown scheme strings", () => {
    const result = resolveAgentUri("ftp://some-file");
    expect(result.scheme).toBe("unknown");
  });
});

describe("fetchHttpUri", () => {
  it("returns decoded JSON on successful fetch", async () => {
    const payload = { name: "Agent", version: 1 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify(payload)),
      }),
    );

    const result = await fetchHttpUri("https://example.com/agent.json");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toEqual(payload);
    expect(result.error).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns error for non-OK HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(""),
      }),
    );

    const result = await fetchHttpUri("https://example.com/missing.json");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toBeNull();
    expect(result.error).toBe("HTTP 404 Not Found");
    vi.unstubAllGlobals();
  });

  it("returns error for non-JSON response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("<html>not json</html>"),
      }),
    );

    const result = await fetchHttpUri("https://example.com/page.html");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toBeNull();
    expect(result.error).toBe("Response is not valid JSON");
    vi.unstubAllGlobals();
  });

  it("returns error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await fetchHttpUri("https://unreachable.example.com");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toBeNull();
    expect(result.error).toBe("Fetch failed: Failed to fetch");
    vi.unstubAllGlobals();
  });

  it("returns timeout error on abort", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await fetchHttpUri("https://slow.example.com");
    expect(result.scheme).toBe("http");
    expect(result.decoded).toBeNull();
    expect(result.error).toBe("Request timed out");
    vi.unstubAllGlobals();
  });
});
