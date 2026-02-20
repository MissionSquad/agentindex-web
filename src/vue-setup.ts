import type { App } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { getEffectiveTheme, type ThemeMode } from "./lib/theme";

const scannerLightTheme = {
  dark: false,
  colors: {
    background: "#f3f7f9",
    surface: "#ffffff",
    primary: "#0b5e67",
    secondary: "#ff7a45",
    accent: "#0f172a",
    info: "#1d4ed8",
    success: "#0f766e",
    warning: "#b45309",
    error: "#b42318",
  },
};

const scannerDarkTheme = {
  dark: true,
  colors: {
    background: "#0f1419",
    surface: "#1e2530",
    primary: "#26a0ab",
    secondary: "#ff9b6a",
    accent: "#e2e8f0",
    info: "#60a5fa",
    success: "#34d399",
    warning: "#fbbf24",
    error: "#f87171",
  },
};

export default (app: App): void => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: "scannerLight",
      themes: {
        scannerLight: scannerLightTheme,
        scannerDark: scannerDarkTheme,
      },
    },
    defaults: {
      VCard: {
        rounded: "lg",
        elevation: 0,
      },
    },
  });

  app.use(vuetify);

  if (typeof document !== "undefined") {
    function syncVuetifyTheme(mode: ThemeMode): void {
      vuetify.theme.change(mode === "dark" ? "scannerDark" : "scannerLight");
    }

    // Defer initial sync until after hydration to avoid mismatch
    requestAnimationFrame(() => {
      syncVuetifyTheme(getEffectiveTheme());
    });

    const onThemeChanged = (e: Event): void => {
      syncVuetifyTheme((e as CustomEvent<ThemeMode>).detail);
    };

    document.addEventListener("theme-changed", onThemeChanged);
    app.onUnmount(() => {
      document.removeEventListener("theme-changed", onThemeChanged);
    });
  }
};
