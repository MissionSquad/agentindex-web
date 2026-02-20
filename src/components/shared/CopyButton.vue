<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  /** The value to copy to the clipboard. */
  value: string;
  /** Tooltip label shown on hover (default: "Copy"). */
  label?: string;
}>();

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // Clipboard API may fail in insecure contexts — silently ignore.
  }
}
</script>

<template>
  <v-btn
    :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
    variant="text"
    density="compact"
    size="x-small"
    :color="copied ? 'success' : undefined"
    :title="copied ? 'Copied!' : (label ?? 'Copy')"
    class="copy-btn"
    @click.stop="copy"
  />
</template>

<style scoped>
.copy-btn {
  opacity: 0.45;
  transition: opacity 0.15s ease;
  margin-left: 4px;
  vertical-align: middle;
  position: relative;
  top: -2px;
  flex-shrink: 0;
}

.copy-btn:hover {
  opacity: 1;
}
</style>
