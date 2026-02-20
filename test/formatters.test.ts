import { describe, expect, it } from "vitest";
import { formatComputedNumber, formatComputedPercent, formatTimestamp, normalizeEpochToMs } from "../src/lib/formatters";

describe("formatters", () => {
  it("normalizes epoch seconds to milliseconds", () => {
    expect(normalizeEpochToMs(1_700_000_000)).toBe(1_700_000_000_000);
  });

  it("keeps millisecond epochs unchanged", () => {
    expect(normalizeEpochToMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it("normalizes microseconds to milliseconds", () => {
    expect(normalizeEpochToMs(1_700_000_000_000_000)).toBe(1_700_000_000_000);
  });

  it("formats second and millisecond epochs consistently", () => {
    expect(formatTimestamp(1_700_000_000)).toBe(formatTimestamp(1_700_000_000_000));
  });
});

describe("formatComputedNumber", () => {
  it("returns 'Not computed' for null", () => {
    expect(formatComputedNumber(null)).toBe("Not computed");
  });

  it("returns 'Not computed' for undefined", () => {
    expect(formatComputedNumber(undefined)).toBe("Not computed");
  });

  it("formats a numeric value", () => {
    expect(formatComputedNumber(42)).toBe("42");
  });

  it("formats zero", () => {
    expect(formatComputedNumber(0)).toBe("0");
  });

  it("formats large numbers with grouping", () => {
    expect(formatComputedNumber(1234)).toBe("1,234");
  });
});

describe("formatComputedPercent", () => {
  it("returns 'Not computed' for null", () => {
    expect(formatComputedPercent(null)).toBe("Not computed");
  });

  it("returns 'Not computed' for undefined", () => {
    expect(formatComputedPercent(undefined)).toBe("Not computed");
  });

  it("formats a decimal as percent", () => {
    expect(formatComputedPercent(0.5)).toBe("50.00%");
  });

  it("formats zero", () => {
    expect(formatComputedPercent(0)).toBe("0.00%");
  });
});
