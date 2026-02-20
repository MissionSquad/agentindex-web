<script setup lang="ts">
import type { DataStatus } from "../../types/api";

const props = withDefaults(
  defineProps<{
    status: DataStatus;
    errorMessage?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  {
    errorMessage: "The request failed. Please retry.",
    emptyTitle: "No data",
    emptyDescription: "No rows were returned for this view.",
  },
);

const emit = defineEmits<{
  retry: [];
}>();

const onRetry = (): void => {
  emit("retry");
};
</script>

<template>
  <div v-if="props.status === 'loading'" class="state-wrap">
    <v-skeleton-loader type="card, article, table" />
  </div>

  <v-card v-else-if="props.status === 'error'" class="state-wrap" border>
    <v-card-title>Error</v-card-title>
    <v-card-text>{{ props.errorMessage }}</v-card-text>
    <v-card-actions>
      <v-btn color="primary" variant="flat" @click="onRetry">Retry</v-btn>
    </v-card-actions>
  </v-card>

  <v-card v-else-if="props.status === 'empty'" class="state-wrap" border>
    <v-card-title>{{ props.emptyTitle }}</v-card-title>
    <v-card-text>{{ props.emptyDescription }}</v-card-text>
  </v-card>

  <div v-else>
    <slot />
  </div>
</template>

<style scoped>
.state-wrap {
  min-height: 220px;
}
</style>
