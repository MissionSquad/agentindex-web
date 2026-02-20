<script setup lang="ts">
import NetworkGraphPanel from "../network/NetworkGraphPanel.vue";
import MetricTile from "../shared/MetricTile.vue";
import { formatNumber, formatPercent } from "../../lib/formatters";
import type { NetworkGraphResponse, TrustMetrics } from "../../types/api";

const props = defineProps<{
  agentId: string;
  graph: NetworkGraphResponse;
  metrics: TrustMetrics;
}>();
</script>

<template>
  <v-row dense class="mb-3">
    <v-col cols="12" md="4">
      <MetricTile
        label="Reciprocal Review Ratio"
        :value="formatPercent(props.metrics.reciprocalReviewRatio)"
        hint="Mutual agent-review pairs / all connected pairs"
      />
    </v-col>
    <v-col cols="12" md="4">
      <MetricTile
        label="Closed Cluster Ratio"
        :value="formatPercent(props.metrics.closedClusterRatio)"
        hint="Internal edges in isolated clusters"
      />
    </v-col>
    <v-col cols="12" md="4">
      <MetricTile
        label="Connected Builder Count"
        :value="formatNumber(props.metrics.connectedBuilderCount)"
        hint="Distinct source agents reviewing this target"
      />
    </v-col>
  </v-row>

  <NetworkGraphPanel :graph="props.graph" :focus-agent-id="props.agentId" title="Agent Trust Neighborhood" />
</template>
