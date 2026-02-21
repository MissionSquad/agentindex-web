<script setup lang="ts">
import MetricTile from "../shared/MetricTile.vue";
import CopyButton from "../shared/CopyButton.vue";

interface EndpointInfo {
  method: string;
  path: string;
  description: string;
  price: string;
}

const x402BaseUrl = "https://x402.agentlist.space";

const endpoints: EndpointInfo[] = [
  {
    method: "GET",
    path: "/v1/search",
    description: "Global search across agents, addresses, tags, and endpoints",
    price: "0.02 USDC",
  },
  {
    method: "GET",
    path: "/v1/search/agents",
    description: "Agent metadata search by name, tags, or services",
    price: "0.02 USDC",
  },
  {
    method: "GET",
    path: "/v1/agents",
    description: "Agent directory listing with filtering and pagination",
    price: "0.02 USDC",
  },
];

const endpointHeaders = [
  { title: "Method", key: "method", sortable: false },
  { title: "Path", key: "path", sortable: false },
  { title: "Description", key: "description", sortable: false },
  { title: "Price", key: "price", sortable: false },
];

const curlExample = `curl -i "https://x402.agentlist.space/v1/search?q=chatbot"`;

const responseExample = `HTTP/1.1 402 Payment Required
X-Payment-Network: eip155:8453
X-Payment-Token: USDC
X-Payment-Amount: 0.02
X-Payment-Recipient: 0x...
Content-Type: application/json

{
  "error": "Payment Required",
  "accepts": {
    "network": "eip155:8453",
    "amount": "0.02",
    "asset": "USDC"
  }
}`;
</script>

<template>
  <section>
    <!-- Header -->
    <v-card border class="mb-4">
      <v-card-title>x402 API Access</v-card-title>
      <v-card-text>
        AgentIndex search endpoints are available via <strong>x402 micropayments</strong> on a dedicated subdomain.
        Each request costs 0.02 USDC on Base. No API keys, no subscriptions &mdash; pay per request with on-chain settlement.
      </v-card-text>
    </v-card>

    <!-- Metric tiles -->
    <v-row dense class="mb-4">
      <v-col cols="12" md="4">
        <MetricTile label="Price Per Request" value="$0.02" hint="USDC on Base" />
      </v-col>
      <v-col cols="12" md="4">
        <MetricTile label="Network" value="Base" hint="eip155:8453" />
      </v-col>
      <v-col cols="12" md="4">
        <MetricTile label="Protected Endpoints" value="3" />
      </v-col>
    </v-row>

    <!-- Base URL callout -->
    <v-card border class="mb-4">
      <v-card-text class="d-flex align-center ga-2">
        <span class="text-body-2" style="color: var(--color-text-muted)">Base URL</span>
        <span class="base-url">{{ x402BaseUrl }}</span>
        <CopyButton :value="x402BaseUrl" label="Copy base URL" />
      </v-card-text>
    </v-card>

    <!-- Endpoints table -->
    <v-card border class="mb-4">
      <v-card-title>Protected Endpoints</v-card-title>
      <v-data-table
        :headers="endpointHeaders"
        :items="endpoints"
        :items-per-page="-1"
        density="comfortable"
        hide-default-footer
      >
        <template #item.method="{ item }">
          <v-chip size="small" color="primary" variant="tonal">{{ item.method }}</v-chip>
        </template>
        <template #item.path="{ item }">
          <code class="endpoint-path">{{ item.path }}</code>
        </template>
        <template #item.price="{ item }">
          <v-chip size="small" color="success" variant="tonal">{{ item.price }}</v-chip>
        </template>
      </v-data-table>
    </v-card>

    <!-- Free endpoints -->
    <v-alert type="info" variant="tonal" border class="mb-4">
      <strong>Free Endpoints</strong> &mdash; The following endpoints are not paywalled and remain accessible on the main API:
      <ul class="mt-2 mb-0">
        <li><code>GET /v1/agents/:agentId</code> &mdash; Individual agent lookup</li>
        <li><code>GET /v1/health</code> &mdash; Health check</li>
      </ul>
    </v-alert>

    <!-- How it works -->
    <v-card border class="mb-4">
      <v-card-title>How x402 Works</v-card-title>
      <v-card-text>
        <v-timeline side="end" density="compact" truncate-line="both">
          <v-timeline-item dot-color="primary" size="small">
            <div><strong>1. Request</strong></div>
            <div class="text-body-2" style="color: var(--color-text-secondary)">
              Client sends a normal GET request to <code>x402.agentlist.space</code>.
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="warning" size="small">
            <div><strong>2. Challenge</strong></div>
            <div class="text-body-2" style="color: var(--color-text-secondary)">
              Server responds with HTTP <code>402 Payment Required</code> and includes payment details (network, token, amount, recipient) in headers.
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="info" size="small">
            <div><strong>3. Pay</strong></div>
            <div class="text-body-2" style="color: var(--color-text-secondary)">
              Client submits a 0.02 USDC payment on Base (eip155:8453) to the specified recipient address.
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="info" size="small">
            <div><strong>4. Retry with proof</strong></div>
            <div class="text-body-2" style="color: var(--color-text-secondary)">
              Client retries the original request, attaching the x402 payment proof in the request header.
            </div>
          </v-timeline-item>
          <v-timeline-item dot-color="success" size="small">
            <div><strong>5. Response</strong></div>
            <div class="text-body-2" style="color: var(--color-text-secondary)">
              Server validates the payment proof and returns the requested data.
            </div>
          </v-timeline-item>
        </v-timeline>
      </v-card-text>
    </v-card>

    <!-- Integration example -->
    <v-card border>
      <v-card-title>Integration Example</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-2" style="color: var(--color-text-secondary)">
          Send a request without payment to see the 402 challenge:
        </p>
        <div class="code-block-wrap">
          <div class="code-block-header">
            <span>Request</span>
            <CopyButton :value="curlExample" label="Copy curl command" />
          </div>
          <pre class="code-block">{{ curlExample }}</pre>
        </div>

        <p class="text-body-2 mt-4 mb-2" style="color: var(--color-text-secondary)">
          Expected 402 response:
        </p>
        <div class="code-block-wrap">
          <div class="code-block-header">
            <span>Response</span>
            <CopyButton :value="responseExample" label="Copy response" />
          </div>
          <pre class="code-block">{{ responseExample }}</pre>
        </div>
      </v-card-text>
    </v-card>
  </section>
</template>

<style scoped>
.base-url {
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
}

.endpoint-path {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  background: var(--color-code-bg);
  padding: 2px 6px;
  border-radius: 4px;
}

.code-block-wrap {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.code-block {
  margin: 0;
  padding: 1rem;
  background: var(--color-code-bg);
  font-family: monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-x: auto;
  color: var(--color-text-primary);
}
</style>
