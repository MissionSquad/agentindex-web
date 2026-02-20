import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import LineSeriesChart from "../src/components/shared/LineSeriesChart.vue";

describe("LineSeriesChart", () => {
  it("renders an SVG polyline when points are provided (ready state)", () => {
    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Test Chart",
        points: [
          { timestamp: 1700000000, value: 10 },
          { timestamp: 1700100000, value: 20 },
          { timestamp: 1700200000, value: 15 },
        ],
        state: "ready",
      },
    });

    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.find("polyline").exists()).toBe(true);
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });

  it("renders zero-events empty message", () => {
    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Test Chart",
        points: [],
        state: "zero-events",
      },
    });

    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".empty-state").text()).toBe("No events in selected window.");
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("renders not-computed empty message", () => {
    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Test Chart",
        points: [],
        state: "not-computed",
      },
    });

    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".empty-state").text()).toBe("Not computed yet for current sync window.");
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("renders custom empty message when provided", () => {
    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Test Chart",
        points: [],
        state: "not-computed",
        emptyMessage: "Custom message here.",
      },
    });

    expect(wrapper.find(".empty-state").text()).toBe("Custom message here.");
  });

  it("renders the chart title", () => {
    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "My Series",
        points: [{ timestamp: 1700000000, value: 5 }],
        state: "ready",
      },
    });

    expect(wrapper.text()).toContain("My Series");
  });

  it("caps points to maxPoints (takes newest N)", () => {
    const points = Array.from({ length: 200 }, (_, i) => ({
      timestamp: 1700000000 + i * 1000,
      value: i,
    }));

    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Capped",
        points,
        state: "ready",
        maxPoints: 50,
      },
    });

    // Should render SVG with markers — check that circle count <= 50
    const circles = wrapper.findAll("circle");
    expect(circles.length).toBeLessThanOrEqual(50);
  });

  it("renders node markers for each point", () => {
    const points = [
      { timestamp: 1700000000, value: 10 },
      { timestamp: 1700100000, value: 20 },
      { timestamp: 1700200000, value: 15 },
    ];

    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Markers",
        points,
        state: "ready",
      },
    });

    const circles = wrapper.findAll("circle");
    expect(circles.length).toBe(3);
  });

  it("uses label from point when available in x-ticks", () => {
    const points = [
      { timestamp: 1700000000, value: 10, label: "Jan 1" },
      { timestamp: 1700100000, value: 20, label: "Jan 2" },
    ];

    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "Labels",
        points,
        state: "ready",
      },
    });

    const xLabels = wrapper.findAll(".x-labels text");
    const texts = xLabels.map((el) => el.text());
    // At least the first tick should use the label from the point
    expect(texts.some((t) => t === "Jan 1" || t === "Jan 2")).toBe(true);
  });

  it("falls back to formatted date tick when label is undefined", () => {
    const points = [
      { timestamp: 1700000000, value: 10 },
      { timestamp: 1700100000, value: 20 },
    ];

    const wrapper = mount(LineSeriesChart, {
      props: {
        title: "No Labels",
        points,
        state: "ready",
      },
    });

    const xLabels = wrapper.findAll(".x-labels text");
    // Should have rendered date-based ticks (M/D format)
    expect(xLabels.length).toBeGreaterThan(0);
    // The formatted date should contain a "/" (M/D format)
    expect(xLabels[0]!.text()).toMatch(/\d+\/\d+/);
  });
});
