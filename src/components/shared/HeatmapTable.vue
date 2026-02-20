<script setup lang="ts">
import type { HeatmapCell } from "../../types/api";
import { formatNumber } from "../../lib/formatters";

const props = defineProps<{
  title: string;
  rows: HeatmapCell[];
}>();

const headers = [
  { title: "X", key: "x" },
  { title: "Y", key: "y" },
  { title: "Value", key: "value" },
];
</script>

<template>
  <v-card border>
    <v-card-title class="text-subtitle-1">{{ props.title }}</v-card-title>
    <v-card-text>
      <v-data-table
        :headers="headers"
        :items="props.rows"
        density="comfortable"
        :items-per-page="8"
      >
        <template #item.value="{ item }">
          {{ formatNumber(item.value) }}
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>
