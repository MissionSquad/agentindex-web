<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, markRaw, type Component } from "vue";
import type { HeatmapCell } from "../../types/api";
import { getEffectiveTheme, type ThemeMode } from "../../lib/theme";
import { formatNumber } from "../../lib/formatters";

interface Props {
  data: HeatmapCell[];
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  height: 450,
});

/** Dynamically loaded apexchart component (avoids SSR window access). */
const ChartComponent = ref<Component | null>(null);
const isDark = ref(false);

onMounted(async () => {
  isDark.value = getEffectiveTheme() === "dark";
  const mod = await import("vue3-apexcharts");
  ChartComponent.value = markRaw(mod.default);
  document.addEventListener("theme-changed", onThemeChanged);
});

onUnmounted(() => {
  document.removeEventListener("theme-changed", onThemeChanged);
});

function onThemeChanged(e: Event): void {
  isDark.value = (e as CustomEvent<ThemeMode>).detail === "dark";
}

/**
 * Groups flat HeatmapCell[] by the X column into ApexCharts multi-series format.
 * Each unique X value becomes a series; Y values are cell labels; value is numeric size.
 */
const chartSeries = computed(() => {
  const grouped = new Map<string, { x: string; y: number }[]>();

  for (const item of props.data) {
    if (!grouped.has(item.x)) {
      grouped.set(item.x, []);
    }
    grouped.get(item.x)!.push({ x: item.y, y: item.value });
  }

  return Array.from(grouped.entries()).map(([name, data]) => ({ name, data }));
});

const chartOptions = computed(() => ({
  chart: {
    type: "treemap" as const,
    toolbar: { show: true },
    background: "transparent",
  },
  theme: {
    mode: isDark.value ? ("dark" as const) : ("light" as const),
  },
  legend: {
    show: false,
  },
  dataLabels: {
    enabled: true,
    style: { fontSize: "13px" },
    formatter: (text: string, op: { value: number }): (string | number)[] => [text, op.value],
  },
  plotOptions: {
    treemap: {
      enableShades: true,
      shadeIntensity: 0.5,
      distributed: false,
      useFillColorAsStroke: false,
      dataLabels: { format: "scale" },
    },
  },
  tooltip: {
    custom: ({
      seriesIndex,
      dataPointIndex,
      w,
    }: {
      series: number[][];
      seriesIndex: number;
      dataPointIndex: number;
      w: { globals: { initialSeries: Array<{ name: string; data: Array<{ x: string; y: number }> }> } };
    }): string => {
      const s = w.globals.initialSeries[seriesIndex];
      const point = s.data[dataPointIndex];
      return `<div style="padding: 8px; font-size: 13px;"><strong>${s.name}</strong><br/>${point.x}: ${formatNumber(point.y)}</div>`;
    },
  },
}));
</script>

<template>
  <v-card border>
    <v-card-title class="text-subtitle-1">Tag Heatmap</v-card-title>
    <v-card-text>
      <component
        v-if="ChartComponent && chartSeries.length > 0"
        :is="ChartComponent"
        type="treemap"
        :height="props.height"
        :options="chartOptions"
        :series="chartSeries"
      />
      <div v-else-if="chartSeries.length === 0" class="text-medium-emphasis text-body-2 pa-4 text-center">
        No tag data available.
      </div>
    </v-card-text>
  </v-card>
</template>
