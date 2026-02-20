<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useTheme } from "vuetify";
import { getEffectiveTheme, getStoredTheme, applyTheme, type ThemeMode } from "../../lib/theme";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "mdi-view-dashboard-outline" },
  { label: "Agents", href: "/agents", icon: "mdi-account-group-outline" },
  { label: "Reputation", href: "/reputation", icon: "mdi-star-outline" },
  { label: "Analytics", href: "/analytics", icon: "mdi-chart-box-outline" },
  { label: "Network", href: "/network", icon: "mdi-graph-outline" },
  { label: "Search", href: "/search", icon: "mdi-magnify" },
];

const menuOpen = ref(false);
const currentTheme = ref<ThemeMode>("light");
const vuetifyTheme = useTheme();

function syncVuetify(): void {
  vuetifyTheme.change(currentTheme.value === "dark" ? "scannerDark" : "scannerLight");
}

function toggleTheme(): void {
  currentTheme.value = currentTheme.value === "dark" ? "light" : "dark";
  applyTheme(currentTheme.value);
  syncVuetify();
}

onMounted(() => {
  currentTheme.value = getEffectiveTheme();
  applyTheme(currentTheme.value);
  syncVuetify();

  // Listen for system preference changes when user has no stored preference
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => {
    if (getStoredTheme() !== null) return;
    currentTheme.value = e.matches ? "dark" : "light";
    applyTheme(currentTheme.value);
    syncVuetify();
  });
});
</script>

<template>
  <div class="nav-shell">
    <v-toolbar :color="currentTheme === 'dark' ? 'surface' : 'white'" elevation="0" border rounded="0">
      <v-btn
        class="d-md-none"
        icon="mdi-menu"
        variant="text"
        aria-label="Open navigation"
        @click="menuOpen = !menuOpen"
      />
      <a href="/" class="brand">AgentIndex</a>

      <div class="nav-links d-none d-md-flex">
        <a v-for="item in navItems" :key="item.href" :href="item.href" class="nav-link">
          <v-icon :icon="item.icon" size="16" />
          <span>{{ item.label }}</span>
        </a>
      </div>

      <v-btn
        :icon="currentTheme === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        :title="currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      />

      <v-menu
        v-model="menuOpen"
        class="d-md-none"
        location="bottom end"
        :close-on-content-click="true"
      >
        <template #activator="{ props: activatorProps }">
          <v-btn
            class="d-md-none"
            icon="mdi-dots-vertical"
            variant="text"
            aria-label="More navigation"
            v-bind="activatorProps"
          />
        </template>

        <v-list min-width="220">
          <v-list-item
            v-for="item in navItems"
            :key="item.href"
            :href="item.href"
            :title="item.label"
            :prepend-icon="item.icon"
          />
        </v-list>
      </v-menu>
    </v-toolbar>
  </div>
</template>

<style scoped>
.nav-shell {
  position: sticky;
  top: 0;
  z-index: 30;
}

.brand {
  color: var(--color-text-primary);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.nav-links {
  margin-left: auto;
  gap: 0.5rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  text-decoration: none;
  color: var(--color-text-secondary);
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  transition: background-color 150ms ease;
}

.nav-link:hover {
  background: var(--color-surface-hover);
}
</style>
