import { describe, expect, it } from "vitest";
import {
  buildDashboardActivityWsUrl,
  computeDashboardActivityReconnectDelayMs,
  parseDashboardActivityStreamMessage,
  resolveDashboardActivityWsBaseUrl,
} from "../src/lib/dashboard-activity-stream";

describe("dashboard-activity-stream", () => {
  it("derives ws base URL from API base URL", () => {
    const httpEnv = { PUBLIC_SCANNER_API_BASE_URL: "http://localhost:3000" } as ImportMetaEnv;
    const httpsEnv = { PUBLIC_SCANNER_API_BASE_URL: "https://api.example.com" } as ImportMetaEnv;

    expect(resolveDashboardActivityWsBaseUrl(httpEnv)).toBe("ws://localhost:3000");
    expect(resolveDashboardActivityWsBaseUrl(httpsEnv)).toBe("wss://api.example.com");
  });

  it("prefers PUBLIC_SCANNER_WS_BASE_URL override", () => {
    const env = {
      PUBLIC_SCANNER_API_BASE_URL: "https://api.example.com",
      PUBLIC_SCANNER_WS_BASE_URL: "wss://stream.example.com/",
    } as ImportMetaEnv;

    expect(resolveDashboardActivityWsBaseUrl(env)).toBe("wss://stream.example.com");
    expect(buildDashboardActivityWsUrl(env)).toBe("wss://stream.example.com/v1/ws/dashboard-activity");
  });

  it("parses valid connected and activity messages", () => {
    const connected = parseDashboardActivityStreamMessage({
      type: "connected",
      timestamp: 1760000000000,
    });
    const activity = parseDashboardActivityStreamMessage({
      type: "activity",
      item: {
        chainId: 1,
        eventName: "NewFeedback",
        agentId: "7",
        agentName: "Agent Seven",
        agentImageUrl: "https://example.com/agent-7.png",
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logIndex: 3,
        timestamp: 1760000001234,
        summary: "Feedback from 0x1",
      },
    });

    expect(connected).toEqual({ type: "connected", timestamp: 1760000000000 });
    expect(activity).toEqual({
      type: "activity",
      item: {
        chainId: 1,
        eventName: "NewFeedback",
        agentId: "7",
        agentName: "Agent Seven",
        agentImageUrl: "https://example.com/agent-7.png",
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logIndex: 3,
        timestamp: 1760000001234,
        summary: "Feedback from 0x1",
      },
    });
  });

  it("rejects malformed stream messages", () => {
    expect(parseDashboardActivityStreamMessage({ type: "connected" })).toBeNull();
    expect(
      parseDashboardActivityStreamMessage({
        type: "activity",
        item: { chainId: 1, txHash: "0xabc" },
      }),
    ).toBeNull();
  });

  it("computes reconnect delay with cap and jitter", () => {
    expect(computeDashboardActivityReconnectDelayMs(0, 0)).toBe(1000);
    expect(computeDashboardActivityReconnectDelayMs(1, 0)).toBe(2000);
    expect(computeDashboardActivityReconnectDelayMs(2, 1)).toBe(4250);
    expect(computeDashboardActivityReconnectDelayMs(10, 0)).toBe(30000);
    expect(computeDashboardActivityReconnectDelayMs(10, 1)).toBe(30250);
  });
});
