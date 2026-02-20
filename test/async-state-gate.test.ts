import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AsyncStateGate from "../src/components/shared/AsyncStateGate.vue";

function mountWithVuetify(status: "loading" | "error" | "empty" | "ready") {
  return mount(AsyncStateGate, {
    props: {
      status,
      errorMessage: "Boom",
      emptyTitle: "Empty",
      emptyDescription: "Nothing here",
    },
    slots: {
      default: "<div id='ready'>Ready</div>",
    },
    global: {
      stubs: {
        "v-skeleton-loader": {
          template: "<div class='v-skeleton-loader' />",
        },
        "v-card": {
          template: "<div><slot /></div>",
        },
        "v-card-title": {
          template: "<div><slot /></div>",
        },
        "v-card-text": {
          template: "<div><slot /></div>",
        },
        "v-card-actions": {
          template: "<div><slot /></div>",
        },
        "v-btn": {
          template: "<button><slot /></button>",
        },
      },
    },
  });
}

describe("AsyncStateGate", () => {
  it("renders loading state", () => {
    const wrapper = mountWithVuetify("loading");
    expect(wrapper.find(".v-skeleton-loader").exists()).toBe(true);
  });

  it("renders error state", async () => {
    const wrapper = mountWithVuetify("error");
    expect(wrapper.text()).toContain("Boom");
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("renders empty state", () => {
    const wrapper = mountWithVuetify("empty");
    expect(wrapper.text()).toContain("Empty");
    expect(wrapper.text()).toContain("Nothing here");
  });

  it("renders ready slot", () => {
    const wrapper = mountWithVuetify("ready");
    expect(wrapper.find("#ready").exists()).toBe(true);
  });
});
