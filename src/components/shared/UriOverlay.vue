<script setup lang="ts">
import { ref } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import CopyButton from "./CopyButton.vue";
import { ScannerApiClient } from "../../lib/api-client";
import { resolveAgentUri, needsAsyncDataResolve, resolveDataUriAsync } from "../../lib/uri-resolver";
import type { ResolvedUri } from "../../lib/uri-resolver";

const api = ScannerApiClient.fromEnv();
const FETCHABLE_SCHEMES = new Set<string>(["http", "ipfs"]);

const overlayOpen = ref(false);
const overlayRaw = ref("");
const overlayLoading = ref(false);
const overlayResolved = ref<ResolvedUri | null>(null);

async function open(rawUri: string): Promise<void> {
  overlayRaw.value = rawUri;
  overlayResolved.value = null;
  overlayLoading.value = false;
  overlayOpen.value = true;

  const local = resolveAgentUri(rawUri);

  if (needsAsyncDataResolve(local)) {
    overlayLoading.value = true;
    try {
      overlayResolved.value = await resolveDataUriAsync(rawUri);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      overlayResolved.value = { scheme: "data-json", raw: rawUri, decoded: null, error: message };
    }
    overlayLoading.value = false;
    return;
  }

  if (local.decoded || local.error || !FETCHABLE_SCHEMES.has(local.scheme)) {
    overlayResolved.value = local;
    return;
  }

  overlayLoading.value = true;
  try {
    const result = await api.resolveUri(rawUri);
    if (result.contentType === "application/json" && result.body !== null) {
      overlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: result.body, error: null };
    } else {
      overlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: null, error: "Response is not JSON" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    overlayResolved.value = { scheme: local.scheme, raw: rawUri, decoded: null, error: message };
  }
  overlayLoading.value = false;
}

defineExpose({ open });
</script>

<template>
  <v-dialog v-model="overlayOpen" max-width="800">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Resolved URI</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="overlayOpen = false" />
      </v-card-title>
      <v-card-text>
        <div class="d-flex align-center mb-3">
          <p :class="['uri-raw', 'flex-grow-1', { 'uri-raw-truncated': overlayRaw.startsWith('data:') }]">{{ overlayRaw }}</p>
          <CopyButton :value="overlayRaw" label="Copy URI" />
        </div>

        <v-progress-linear v-if="overlayLoading" indeterminate color="primary" class="mb-2" />

        <template v-else-if="overlayResolved">
          <div v-if="overlayResolved.decoded" class="json-container">
            <vue-json-pretty
              :data="(overlayResolved.decoded as Record<string, unknown>)"
              :deep="3"
              :show-line="true"
              :collapsed-on-click-brackets="true"
            />
          </div>
          <v-alert v-else-if="overlayResolved.error" type="warning" variant="tonal" density="compact">
            {{ overlayResolved.error }}
          </v-alert>
          <p v-else class="text-body-2 text-medium-emphasis">No content resolved.</p>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="overlayOpen = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.uri-raw {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  word-break: break-all;
  margin: 0;
}

.uri-raw-truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.json-container {
  border: 1px solid var(--color-container-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--color-code-bg);
  max-height: 400px;
  overflow: auto;
}
</style>
