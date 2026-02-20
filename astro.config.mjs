// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://agentindex.space",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    vue({
      appEntrypoint: "/src/vue-setup.ts",
      jsx: false,
    }),
    sitemap(),
  ],
  vite: {
    resolve: {
      dedupe: ["vue"],
    },
    ssr: {
      noExternal: ["vuetify"],
    },
  },
});
