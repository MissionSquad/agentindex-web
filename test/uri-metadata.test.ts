import { describe, expect, it } from "vitest";
import { extractAgentUriMetadata } from "../src/lib/uri-metadata";

const ALL_NULL = {
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

describe("extractAgentUriMetadata", () => {
  // -----------------------------------------------------------------------
  // Null / invalid input
  // -----------------------------------------------------------------------

  it("returns all nulls for null input", () => {
    expect(extractAgentUriMetadata(null)).toEqual(ALL_NULL);
  });

  it("returns all nulls for non-object input", () => {
    expect(extractAgentUriMetadata("string")).toEqual(ALL_NULL);
    expect(extractAgentUriMetadata(42)).toEqual(ALL_NULL);
  });

  it("returns all nulls for an array", () => {
    expect(extractAgentUriMetadata([1, 2])).toEqual(ALL_NULL);
  });

  it("returns all nulls for empty object", () => {
    expect(extractAgentUriMetadata({})).toEqual(ALL_NULL);
  });

  // -----------------------------------------------------------------------
  // name / description
  // -----------------------------------------------------------------------

  it("extracts name and description from valid object", () => {
    const result = extractAgentUriMetadata({ name: "Agent", description: "A test agent" });
    expect(result.name).toBe("Agent");
    expect(result.description).toBe("A test agent");
  });

  it("returns null for empty string name/description", () => {
    const result = extractAgentUriMetadata({ name: "", description: "" });
    expect(result.name).toBeNull();
    expect(result.description).toBeNull();
  });

  // -----------------------------------------------------------------------
  // type
  // -----------------------------------------------------------------------

  it("extracts type from valid string", () => {
    expect(extractAgentUriMetadata({ type: "ai-agent" }).type).toBe("ai-agent");
  });

  it("returns null type for non-string or empty", () => {
    expect(extractAgentUriMetadata({ type: 42 }).type).toBeNull();
    expect(extractAgentUriMetadata({ type: "" }).type).toBeNull();
  });

  // -----------------------------------------------------------------------
  // image
  // -----------------------------------------------------------------------

  it("extracts image URL", () => {
    expect(extractAgentUriMetadata({ image: "ipfs://QmSomeHash" }).image).toBe("ipfs://QmSomeHash");
  });

  it("extracts image data URI", () => {
    expect(extractAgentUriMetadata({ image: "data:image/png;base64,abc" }).image).toBe(
      "data:image/png;base64,abc",
    );
  });

  it("returns null image for empty string", () => {
    expect(extractAgentUriMetadata({ image: "" }).image).toBeNull();
  });

  // -----------------------------------------------------------------------
  // active
  // -----------------------------------------------------------------------

  it("extracts active true", () => {
    expect(extractAgentUriMetadata({ active: true }).active).toBe(true);
  });

  it("extracts active false", () => {
    expect(extractAgentUriMetadata({ active: false }).active).toBe(false);
  });

  it("returns null active for non-boolean", () => {
    expect(extractAgentUriMetadata({ active: "yes" }).active).toBeNull();
    expect(extractAgentUriMetadata({ active: 1 }).active).toBeNull();
  });

  // -----------------------------------------------------------------------
  // x402Support + x402support merge
  // -----------------------------------------------------------------------

  it("extracts x402Support true", () => {
    expect(extractAgentUriMetadata({ x402Support: true }).x402Support).toBe(true);
  });

  it("extracts x402Support false", () => {
    expect(extractAgentUriMetadata({ x402Support: false }).x402Support).toBe(false);
  });

  it("returns null x402Support for non-boolean value", () => {
    expect(extractAgentUriMetadata({ x402Support: "yes" }).x402Support).toBeNull();
    expect(extractAgentUriMetadata({ x402Support: 1 }).x402Support).toBeNull();
  });

  it("extracts x402support (lowercase variant)", () => {
    expect(extractAgentUriMetadata({ x402support: true }).x402Support).toBe(true);
  });

  it("prefers x402Support over x402support when both present", () => {
    expect(
      extractAgentUriMetadata({ x402Support: false, x402support: true }).x402Support,
    ).toBe(false);
  });

  // -----------------------------------------------------------------------
  // erc8004Support (from "8004Support")
  // -----------------------------------------------------------------------

  it("extracts 8004Support as erc8004Support", () => {
    expect(extractAgentUriMetadata({ "8004Support": true }).erc8004Support).toBe(true);
  });

  it("returns null erc8004Support for non-boolean", () => {
    expect(extractAgentUriMetadata({ "8004Support": "yes" }).erc8004Support).toBeNull();
  });

  // -----------------------------------------------------------------------
  // services
  // -----------------------------------------------------------------------

  it("extracts services as string array", () => {
    expect(extractAgentUriMetadata({ services: ["web3", "defi"] }).services).toEqual([
      "web3",
      "defi",
    ]);
  });

  it("filters non-string entries from services", () => {
    expect(
      extractAgentUriMetadata({ services: ["valid", 42, null, "also-valid"] }).services,
    ).toEqual(["valid", "also-valid"]);
  });

  it("returns null services for non-array value", () => {
    expect(extractAgentUriMetadata({ services: "single" }).services).toBeNull();
  });

  // -----------------------------------------------------------------------
  // registrations
  // -----------------------------------------------------------------------

  it("extracts registrations as string array", () => {
    expect(extractAgentUriMetadata({ registrations: ["a2a", "mcp"] }).registrations).toEqual([
      "a2a",
      "mcp",
    ]);
  });

  it("filters non-string entries from registrations", () => {
    expect(extractAgentUriMetadata({ registrations: ["valid", 42] }).registrations).toEqual([
      "valid",
    ]);
  });

  it("returns null registrations for non-array", () => {
    expect(extractAgentUriMetadata({ registrations: "single" }).registrations).toBeNull();
  });

  // -----------------------------------------------------------------------
  // supportedTrusts + supportedTrust merge
  // -----------------------------------------------------------------------

  it("extracts supportedTrusts array", () => {
    expect(
      extractAgentUriMetadata({ supportedTrusts: ["trustA", "trustB"] }).supportedTrusts,
    ).toEqual(["trustA", "trustB"]);
  });

  it("wraps single supportedTrust in array", () => {
    expect(extractAgentUriMetadata({ supportedTrust: "trustA" }).supportedTrusts).toEqual([
      "trustA",
    ]);
  });

  it("merges supportedTrust and supportedTrusts, deduplicating", () => {
    const result = extractAgentUriMetadata({
      supportedTrusts: ["trustA", "trustB"],
      supportedTrust: "trustA",
    });
    expect(result.supportedTrusts).toEqual(["trustA", "trustB"]);
  });

  it("merges supportedTrust and supportedTrusts when no overlap", () => {
    const result = extractAgentUriMetadata({
      supportedTrusts: ["trustA"],
      supportedTrust: "trustC",
    });
    expect(result.supportedTrusts).toEqual(["trustA", "trustC"]);
  });

  it("accepts supportedTrust as an array fallback", () => {
    expect(
      extractAgentUriMetadata({ supportedTrust: ["trustX", "trustY"] }).supportedTrusts,
    ).toEqual(["trustX", "trustY"]);
  });

  it("merges supportedTrusts array with supportedTrust array, deduplicating", () => {
    const result = extractAgentUriMetadata({
      supportedTrusts: ["trustA"],
      supportedTrust: ["trustA", "trustB"],
    });
    expect(result.supportedTrusts).toEqual(["trustA", "trustB"]);
  });

  it("returns null supportedTrusts when neither field present", () => {
    expect(extractAgentUriMetadata({}).supportedTrusts).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Complete payload
  // -----------------------------------------------------------------------

  it("extracts all fields from a complete payload", () => {
    const payload = {
      name: "NineTon",
      description: "A high-fidelity digital companion",
      type: "ai-agent",
      image: "ipfs://QmSomeHash",
      active: true,
      x402Support: true,
      "8004Support": true,
      services: ["reputation"],
      registrations: ["a2a"],
      supportedTrusts: ["trustA"],
      supportedTrust: "trustB",
    };
    const result = extractAgentUriMetadata(payload);
    expect(result.name).toBe("NineTon");
    expect(result.description).toBe("A high-fidelity digital companion");
    expect(result.type).toBe("ai-agent");
    expect(result.image).toBe("ipfs://QmSomeHash");
    expect(result.active).toBe(true);
    expect(result.x402Support).toBe(true);
    expect(result.erc8004Support).toBe(true);
    expect(result.services).toEqual(["reputation"]);
    expect(result.registrations).toEqual(["a2a"]);
    expect(result.supportedTrusts).toEqual(["trustA", "trustB"]);
  });
});
