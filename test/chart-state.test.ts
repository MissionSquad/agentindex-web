import { describe, expect, it } from "vitest";
import { resolveChartState } from "../src/lib/chart-state";
import type { ChartStateContext } from "../src/lib/chart-state";

function makeCtx(overrides: Partial<ChartStateContext["dashboardMetrics"]> = {}, heuristicsOverrides: Partial<ChartStateContext["heuristics"]> = {}): ChartStateContext {
  return {
    dashboardMetrics: {
      totalRegisteredAgents: 10,
      newAgents24h: 1,
      newAgents7d: 3,
      newAgents30d: 8,
      totalFeedbackSubmitted: 194,
      activeFeedback: 180,
      uniqueClientAddresses: 50,
      totalResponsesAppended: 5,
      agentTransfers: 13,
      ...overrides,
    },
    heuristics: {
      ecosystemGrowthVelocity: 1.2,
      feedbackDensity: 0.5,
      revocationRate: 0,
      dormantAgentRatio: 0.1,
      responseEngagementRate: 0.3,
      transferRate: 0.05,
      networkGiniCoefficient: null,
      responderConcentration: null,
      ...heuristicsOverrides,
    },
  };
}

describe("resolveChartState", () => {
  it("returns ready when points exist", () => {
    const result = resolveChartState("registrations", [{ timestamp: 1, value: 5 }], makeCtx());
    expect(result.state).toBe("ready");
  });

  // --- registrations ---
  it("registrations: zero-events when totalRegisteredAgents is 0", () => {
    const result = resolveChartState("registrations", [], makeCtx({ totalRegisteredAgents: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("registrations: not-computed when totalRegisteredAgents > 0", () => {
    const result = resolveChartState("registrations", [], makeCtx({ totalRegisteredAgents: 10 }));
    expect(result.state).toBe("not-computed");
  });

  // --- feedbackVolume ---
  it("feedbackVolume: zero-events when totalFeedbackSubmitted is 0", () => {
    const result = resolveChartState("feedbackVolume", [], makeCtx({ totalFeedbackSubmitted: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("feedbackVolume: not-computed when totalFeedbackSubmitted > 0", () => {
    const result = resolveChartState("feedbackVolume", [], makeCtx({ totalFeedbackSubmitted: 194 }));
    expect(result.state).toBe("not-computed");
  });

  // --- responseVolume ---
  it("responseVolume: zero-events when totalResponsesAppended is 0", () => {
    const result = resolveChartState("responseVolume", [], makeCtx({ totalResponsesAppended: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("responseVolume: not-computed when totalResponsesAppended > 0", () => {
    const result = resolveChartState("responseVolume", [], makeCtx({ totalResponsesAppended: 5 }));
    expect(result.state).toBe("not-computed");
  });

  // --- transferVolume ---
  it("transferVolume: zero-events when agentTransfers is 0", () => {
    const result = resolveChartState("transferVolume", [], makeCtx({ agentTransfers: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("transferVolume: not-computed when agentTransfers > 0", () => {
    const result = resolveChartState("transferVolume", [], makeCtx({ agentTransfers: 13 }));
    expect(result.state).toBe("not-computed");
  });

  // --- revocationVolume ---
  it("revocationVolume: zero-events when revocationRate is 0", () => {
    const result = resolveChartState("revocationVolume", [], makeCtx({}, { revocationRate: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("revocationVolume: not-computed when revocationRate is null", () => {
    const result = resolveChartState("revocationVolume", [], makeCtx({}, { revocationRate: null }));
    expect(result.state).toBe("not-computed");
  });

  // --- activeAgents ---
  it("activeAgents: not-computed when totalRegisteredAgents > 0", () => {
    const result = resolveChartState("activeAgents", [], makeCtx({ totalRegisteredAgents: 10 }));
    expect(result.state).toBe("not-computed");
  });

  it("activeAgents: zero-events when totalRegisteredAgents is 0", () => {
    const result = resolveChartState("activeAgents", [], makeCtx({ totalRegisteredAgents: 0 }));
    expect(result.state).toBe("zero-events");
  });

  // --- clientGrowth ---
  it("clientGrowth: zero-events when uniqueClientAddresses is 0", () => {
    const result = resolveChartState("clientGrowth", [], makeCtx({ uniqueClientAddresses: 0 }));
    expect(result.state).toBe("zero-events");
  });

  it("clientGrowth: not-computed when uniqueClientAddresses > 0", () => {
    const result = resolveChartState("clientGrowth", [], makeCtx({ uniqueClientAddresses: 50 }));
    expect(result.state).toBe("not-computed");
  });

  // --- responderGrowth ---
  it("responderGrowth: not-computed when totalResponsesAppended > 0", () => {
    const result = resolveChartState("responderGrowth", [], makeCtx({ totalResponsesAppended: 5 }));
    expect(result.state).toBe("not-computed");
  });

  it("responderGrowth: zero-events when totalResponsesAppended is 0", () => {
    const result = resolveChartState("responderGrowth", [], makeCtx({ totalResponsesAppended: 0 }));
    expect(result.state).toBe("zero-events");
  });

  // --- integrityHealth ---
  it("integrityHealth: not-computed when totalFeedbackSubmitted > 0", () => {
    const result = resolveChartState("integrityHealth", [], makeCtx({ totalFeedbackSubmitted: 194 }));
    expect(result.state).toBe("not-computed");
  });

  it("integrityHealth: zero-events when totalFeedbackSubmitted is 0", () => {
    const result = resolveChartState("integrityHealth", [], makeCtx({ totalFeedbackSubmitted: 0 }));
    expect(result.state).toBe("zero-events");
  });

  // --- topAgentsByFeedback ---
  it("topAgentsByFeedback: not-computed when totalFeedbackSubmitted > 0", () => {
    const result = resolveChartState("topAgentsByFeedback", [], makeCtx({ totalFeedbackSubmitted: 194 }));
    expect(result.state).toBe("not-computed");
  });

  // --- always not-computed series ---
  it("tagHeatmap: always not-computed when empty", () => {
    const result = resolveChartState("tagHeatmap", [], makeCtx());
    expect(result.state).toBe("not-computed");
  });

  it("endpointHeatmap: always not-computed when empty", () => {
    const result = resolveChartState("endpointHeatmap", [], makeCtx());
    expect(result.state).toBe("not-computed");
  });

  it("protocolDistribution: always not-computed when empty", () => {
    const result = resolveChartState("protocolDistribution", [], makeCtx());
    expect(result.state).toBe("not-computed");
  });

  it("timeToFirstFeedbackDistribution: always not-computed when empty", () => {
    const result = resolveChartState("timeToFirstFeedbackDistribution", [], makeCtx());
    expect(result.state).toBe("not-computed");
  });

  it("selectedAgentFeedbackVelocity: always not-computed when empty", () => {
    const result = resolveChartState("selectedAgentFeedbackVelocity", [], makeCtx());
    expect(result.state).toBe("not-computed");
  });

  // --- messages ---
  it("provides correct message for zero-events", () => {
    const result = resolveChartState("feedbackVolume", [], makeCtx({ totalFeedbackSubmitted: 0 }));
    expect(result.message).toBe("No events in selected window.");
  });

  it("provides correct message for not-computed", () => {
    const result = resolveChartState("feedbackVolume", [], makeCtx({ totalFeedbackSubmitted: 194 }));
    expect(result.message).toBe("Not computed yet for current sync window.");
  });

  it("provides empty message for ready", () => {
    const result = resolveChartState("feedbackVolume", [{ timestamp: 1, value: 5 }], makeCtx());
    expect(result.message).toBe("");
  });
});
