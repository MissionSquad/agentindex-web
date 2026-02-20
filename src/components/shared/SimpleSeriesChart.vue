<script setup lang="ts">
import { computed } from "vue";
import type { TimeSeriesPoint } from "../../types/api";
import { formatNumber } from "../../lib/formatters";

const props = withDefaults(
  defineProps<{
    title: string;
    points: TimeSeriesPoint[];
    color?: string;
  }>(),
  {
    color: "#0b5e67",
  },
);

const maxValue = computed<number>(() => {
  const values = props.points.map((point) => point.value);
  return values.length === 0 ? 1 : Math.max(...values, 1);
});
</script>

<template>
  <v-card border>
    <v-card-title class="text-subtitle-1">{{ props.title }}</v-card-title>
    <v-card-text>
      <div v-if="props.points.length === 0" class="empty">No points yet.</div>
      <div v-else class="bars">
        <div v-for="point in props.points.slice(-14)" :key="`${point.timestamp}-${point.label}`" class="bar-col">
          <div class="bar" :style="{ height: `${(point.value / maxValue) * 100}%`, backgroundColor: props.color }" />
          <span class="bar-label">{{ point.label }}</span>
          <span class="bar-value">{{ formatNumber(point.value) }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.empty {
  color: var(--color-text-muted);
}

.bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(46px, 1fr));
  align-items: end;
  gap: 0.45rem;
  min-height: 200px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
}

.bar {
  width: 100%;
  border-radius: 10px 10px 2px 2px;
  min-height: 8px;
}

.bar-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.bar-value {
  font-size: 0.7rem;
  color: var(--color-text-primary);
}
</style>
