import type { App } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

export default (app: App) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: "dark",
    },
  });

  app.use(vuetify);
};
