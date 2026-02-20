<script setup lang="ts">
const props = defineProps<{
  label: string;
  value: string;
  hint?: string;
}>();
</script>

<template>
  <v-card class="metric-tile" border>
    <v-card-text>
      <p class="label">{{ props.label }}</p>
      <p class="value">{{ props.value }}</p>
      <p v-if="props.hint" class="hint">{{ props.hint }}</p>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.metric-tile {
  height: 100%;
  background: linear-gradient(160deg, var(--color-surface), var(--color-surface-alt));
}

.label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-label);
}

.value {
  margin: 0.15rem 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.hint {
  margin: 0.3rem 0 0;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
</style>
