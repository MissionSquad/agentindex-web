<script setup lang="ts">
import { computed, ref } from "vue";
import AsyncStateGate from "../shared/AsyncStateGate.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { classifySearchInput } from "../../lib/query";
import { useAsyncView } from "../../lib/view-state";
import type { SearchResponse } from "../../types/api";

const api = ScannerApiClient.fromEnv();

const searchInput = ref("");
const page = ref(1);

const state = useAsyncView<SearchResponse>(
  () =>
    api.search({
      q: searchInput.value,
      page: page.value,
      limit: 25,
    }),
  (payload) => payload.results.items.length === 0,
  false,
);

const quickRoute = computed<string | null>(() => {
  const trimmed = searchInput.value.trim();
  if (!trimmed) {
    return null;
  }

  const type = classifySearchInput(trimmed);

  if (type === "agent") {
    return `/agents/${trimmed}`;
  }

  if (type === "address") {
    return `/address/${trimmed.toLowerCase()}`;
  }

  if (type === "transaction") {
    return `/tx/${trimmed.toLowerCase()}`;
  }

  return null;
});

const runSearch = async (): Promise<void> => {
  page.value = 1;

  if (!searchInput.value.trim()) {
    state.status.value = "empty";
    state.data.value = null;
    state.errorMessage.value = "";
    return;
  }

  await state.refresh();
};
</script>

<template>
  <section>
    <v-card border class="mb-4">
      <v-card-title>Global Search</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="9">
            <v-text-field
              v-model="searchInput"
              label="Search by agent id, address, tx hash, name, tag, endpoint"
              @keyup.enter="runSearch"
            />
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center justify-end">
            <v-btn color="primary" @click="runSearch">Search</v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="quickRoute" color="info" variant="tonal" class="mt-2">
          Direct route match:
          <a :href="quickRoute">{{ quickRoute }}</a>
        </v-alert>
      </v-card-text>
    </v-card>

    <AsyncStateGate
      :status="state.status.value"
      :error-message="state.errorMessage.value"
      empty-title="No search results"
      empty-description="Try agent id, Ethereum address, tx hash, tag, endpoint, or agent name."
      @retry="state.refresh"
    >
      <v-card border>
        <v-data-table
          :headers="[
            { title: 'Type', key: 'type' },
            { title: 'Title', key: 'title' },
            { title: 'Subtitle', key: 'subtitle' },
            { title: 'Route', key: 'route' },
          ]"
          :items="state.data.value?.results.items ?? []"
        >
          <template #item.route="{ item }">
            <a :href="item.route">{{ item.route }}</a>
          </template>
        </v-data-table>
      </v-card>
    </AsyncStateGate>
  </section>
</template>
