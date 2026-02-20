import { describe, expect, it } from "vitest";
import { agentProfileLayoutForWidth, dashboardLayoutForWidth, networkLayoutForWidth } from "../src/lib/breakpoints";

describe("mobile breakpoint smoke", () => {
  it("uses mobile layout for dashboard, agent profile, and network pages", () => {
    expect(dashboardLayoutForWidth(375)).toEqual({ isMobile: true, columns: 1 });
    expect(agentProfileLayoutForWidth(375)).toEqual({ isMobile: true, columns: 1 });
    expect(networkLayoutForWidth(375)).toEqual({ isMobile: true, columns: 1 });
  });

  it("uses desktop/tablet layout above breakpoint", () => {
    expect(dashboardLayoutForWidth(1280).columns).toBeGreaterThan(1);
    expect(agentProfileLayoutForWidth(1280).isMobile).toBe(false);
    expect(networkLayoutForWidth(1280).columns).toBeGreaterThan(1);
  });
});
