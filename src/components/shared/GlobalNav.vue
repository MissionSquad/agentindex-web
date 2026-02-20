<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useTheme } from "vuetify";
import { getEffectiveTheme, getStoredTheme, applyTheme, type ThemeMode } from "../../lib/theme";
import { ScannerApiClient } from "../../lib/api-client";
import { classifySearchInput } from "../../lib/query";

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
];

const api = ScannerApiClient.fromEnv();
const searchInput = ref("");
const searching = ref(false);
const searchFocused = ref(false);
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

async function handleSearch(): Promise<void> {
  const trimmed = searchInput.value.trim();
  if (!trimmed) return;

  const type = classifySearchInput(trimmed);

  if (type === "agent") {
    window.location.href = `/agents/${trimmed}`;
    return;
  }
  if (type === "address") {
    window.location.href = `/address/${trimmed.toLowerCase()}`;
    return;
  }
  if (type === "transaction") {
    window.location.href = `/tx/${trimmed.toLowerCase()}`;
    return;
  }

  searching.value = true;

  try {
    const response = await api.search({ q: trimmed, limit: 2 });
    const items = response.results.items;

    if (items.length === 1) {
      window.location.href = items[0].route;
      return;
    }

    window.location.href = `/search?q=${encodeURIComponent(trimmed)}`;
  } catch {
    window.location.href = `/search?q=${encodeURIComponent(trimmed)}`;
  } finally {
    searching.value = false;
  }
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
      <a href="/" class="brand">
        <span class="brand-name">Agent Index</span>
        <span class="brand-tagline">ERC-8004 Reputation Tracker</span>
      </a>

      <div class="nav-links d-none d-md-flex">
        <v-text-field
          v-model="searchInput"
          :class="['nav-search', { 'nav-search--expanded': searchFocused }]"
          placeholder="Search..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          single-line
          :loading="searching"
          @keyup.enter="handleSearch"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
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
          <v-list-item href="/search" title="Search" prepend-icon="mdi-magnify" />
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
  display: flex;
  flex-direction: column;
  text-decoration: none;
  margin-left: 0.75rem;
  line-height: 1.15;
}

.brand-name {
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.04em;
}

.brand-tagline {
  color: var(--color-text-muted);
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.03em;
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

.nav-search {
  flex: 0 0 auto;
  width: 260px;
  transition: width 250ms ease;
}

.nav-search--expanded {
  width: 480px;
}
</style>
