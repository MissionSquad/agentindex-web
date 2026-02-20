import type { TimeSeriesPoint, AnalyticsOverviewResponse } from "../types/api";

export type ChartRenderState = "ready" | "zero-events" | "not-computed";

export interface ChartState {
  state: ChartRenderState;
  message: string;
}

const MESSAGES: Record<ChartRenderState, string> = {
  ready: "",
  "zero-events": "No events in selected window.",
  "not-computed": "Not computed yet for current sync window.",
};

function classify(state: ChartRenderState): ChartState {
  return { state, message: MESSAGES[state] };
}

export type ChartSeriesKey =
  | "registrations"
  | "feedbackVolume"
  | "responseVolume"
  | "transferVolume"
  | "revocationVolume"
  | "activeAgents"
  | "clientGrowth"
  | "responderGrowth"
  | "integrityHealth"
  | "topAgentsByFeedback"
  | "tagHeatmap"
  | "endpointHeatmap"
  | "protocolDistribution"
  | "timeToFirstFeedbackDistribution"
  | "selectedAgentFeedbackVelocity";

export interface ChartStateContext {
  dashboardMetrics: AnalyticsOverviewResponse["dashboardMetrics"];
  heuristics: AnalyticsOverviewResponse["heuristics"];
}

/**
 * Deterministic chart-state classification.
 *
 * Classifies empty chart series into one of three states based on
 * upstream metric values that indicate whether the emptiness represents
 * genuine zero activity or an uncomputed placeholder.
 */
export function resolveChartState(
  key: ChartSeriesKey,
  points: readonly TimeSeriesPoint[] | readonly unknown[],
  ctx: ChartStateContext,
): ChartState {
  if (points.length > 0) {
    return classify("ready");
  }

  const { dashboardMetrics, heuristics } = ctx;

  switch (key) {
    case "registrations":
      return classify(dashboardMetrics.totalRegisteredAgents === 0 ? "zero-events" : "not-computed");

    case "feedbackVolume":
      return classify(dashboardMetrics.totalFeedbackSubmitted === 0 ? "zero-events" : "not-computed");

    case "responseVolume":
      return classify(dashboardMetrics.totalResponsesAppended === 0 ? "zero-events" : "not-computed");

    case "transferVolume":
      return classify(dashboardMetrics.agentTransfers === 0 ? "zero-events" : "not-computed");

    case "revocationVolume":
      if (heuristics.revocationRate === 0) {
        return classify("zero-events");
      }
      if (heuristics.revocationRate === null) {
        return classify("not-computed");
      }
      return classify("not-computed");

    case "activeAgents":
      return classify(dashboardMetrics.totalRegisteredAgents > 0 ? "not-computed" : "zero-events");

    case "clientGrowth":
      return classify(dashboardMetrics.uniqueClientAddresses === 0 ? "zero-events" : "not-computed");

    case "responderGrowth":
      return classify(dashboardMetrics.totalResponsesAppended > 0 ? "not-computed" : "zero-events");

    case "integrityHealth":
      return classify(dashboardMetrics.totalFeedbackSubmitted > 0 ? "not-computed" : "zero-events");

    case "topAgentsByFeedback":
      return classify(dashboardMetrics.totalFeedbackSubmitted > 0 ? "not-computed" : "zero-events");

    case "tagHeatmap":
    case "endpointHeatmap":
    case "protocolDistribution":
    case "timeToFirstFeedbackDistribution":
    case "selectedAgentFeedbackVelocity":
      return classify("not-computed");

    default:
      return classify("not-computed");
  }
}
