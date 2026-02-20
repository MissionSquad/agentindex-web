# AgentIndex Frontend

Astro SSR + Vue 3 + Vuetify 3 frontend for [agentindex.space](https://agentindex.space).

## Pages

### Dashboard (`/`)

**API:** `GET /v1/analytics/overview`, `GET /v1/resolve/uri`, `GET /v1/resolve/image`

The main landing page. Displays a high-level overview of the ERC-8004 ecosystem:

- **Metric tiles** — Registered Agents, New Agents (24h/7d/30d), Total Feedback, Unique Clients, Responses, Transfers
- **Top 10 Agents** — Ranked by feedback count, showing agent image, name, reputation score, client diversity, and feedback count. Agent URIs are resolved (data URI, HTTP, IPFS) to display names and avatars.
- **Windowed heuristics** — Ecosystem Growth Velocity, Feedback Density, Dormant Agent Ratio, Response Engagement Rate, Transfer Rate (each with 24h/7d/30d columns)
- **Live activity feed** — 12 most recent on-chain events with event name, summary, timestamp, and transaction hash link
- **Trend charts** — Agent Registrations, Feedback Submissions, Ownership Transfers (line series over time)

---

### Agent Directory (`/agents`)

**API:** `GET /v1/agents`, `GET /v1/resolve/uri`

Paginated, sortable, filterable directory of all registered agents.

- **Columns** — Agent ID, Name (linked to agent profile, resolved from agent URI JSON), Owner, Registrant, Feedback Count, Reputation Score, Registration Date, Transfer Status
- **Filters** — Sort order (newest, oldest, most-feedback, highest-reputation, recently-active), has feedback, registered in last N days, tag, x402 support, protocol (a2a/mcp/oasf/web), transfer status, response status
- **Pagination** — Page controls with 10/25/50/100 rows per page

---

### Agent Profile (`/agents/[agentId]`)

**API:** `GET /v1/agents/:agentId`, `GET /v1/resolve/uri`, `GET /v1/resolve/image`

Comprehensive detail page for a single agent, organized in tabs:

- **Header** — Avatar image, name, ID, reputation score (color-coded), description
- **Summary fields** — Current owner, original registrant, payout wallet, registration tx, registration date, transfer count, type, active status, ERC-8004 support, x402 support, supported trusts, services, registrations
- **Transaction History tab** — Event name, summary, timestamp, tx hash
- **Ownership History tab** — From/to addresses, event type, timestamp, tx hash
- **URI History tab** — URI value, updated-by address, timestamp, tx hash
- **Trust Network tab** — Agent-scoped graph visualization with trust metrics (reciprocal review ratio, closed cluster ratio, connected builders)
- **Reputation tab** — 10 heuristic metrics (reputation score, client diversity, revocation rate, response rate, recency bias, time-to-first-feedback, revocation latency, response latency, integrity pass rate, feedback burst ratio), feedback table (client, value, tags, endpoint, integrity, revoked, responses, timestamp, tx hash), response details table
- **Metadata tab** — Metadata key/value history with timestamps and tx hashes
- **Current URI section** — Raw URI display, resolved JSON content, error states

---

### Reputation Explorer (`/reputation`)

**API:** `GET /v1/reputation`, `GET /v1/resolve/uri`

Global reputation activity explorer with filterable, paginated tables.

- **Metric tiles** — Total Feedback, Total Revocations, Total Responses, Unique Clients, Feedback Velocity, Responder Diversity, Integrity Failure Rate
- **Recent Responses table** — Timestamp, Agent ID, Client Address, Responder Address, Response (extracted from resolved URI JSON, truncated to 20 chars with overlay popup), Tx Hash (linked to transaction page)
- **Recent Feedback table** — Timestamp, Agent ID, Client Address, Value, Tag 1, Tag 2, Endpoint, Revoked status, Tx Hash (linked to transaction page)
- **Filters** — Tag, endpoint, pagination (10/25/50/100 rows)

---

### Agent Reputation (`/reputation/[agentId]`)

**API:** `GET /v1/reputation/:agentId`

Agent-scoped reputation data with feedback received and responses.

- **Metric tiles** — Total Feedback, Total Responses, Integrity Failure Rate
- **Agent Feedback table** — Timestamp, Client Address, Value, Tag 1, Tag 2, Endpoint, Revoked status, Tx Hash
- **Agent Responses table** — Timestamp, Client Address, Feedback Index, Responder Address, Response URI, Tx Hash

---

### Address Profile (`/address/[address]`)

**API:** `GET /v1/address/:address`

Wallet-centric activity profile showing all interactions from a given Ethereum address.

- **Metrics** — Avg Score Given, Feedback Integrity Rate, Avg Response Latency
- **As Owner** — Agents currently owned, originally registered, transferred away, received via transfer
- **As Payout Wallet** — Linked agents
- **As URI Updater** — URI update count
- **As Feedback Client table** — Timestamp, Agent, Value, Tag 1, Tag 2, Endpoint, Integrity, Tx Hash
- **As Responder table** — Timestamp, Agent, Client Address, Feedback Index, Response URI, Tx Hash

---

### Transaction Detail (`/tx/[txHash]`)

**API:** `GET /v1/transactions/:txHash`, `GET /v1/resolve/uri`

Decoded transaction viewer for on-chain inspection.

- **Transaction envelope** — Tx Hash, Chain ID, Registry Address, Block Number, Block Hash, Transaction Index, Timestamp, From, To, Nonce, Value, Gas, Gas Used, Gas Price, Max Fee, Max Priority Fee, Cumulative Gas Used
- **Function call decode** — Function name, signature, arguments table with values and copy buttons. URI arguments are clickable and open a resolution overlay.
- **URI resolution overlay** — Fetches and displays resolved JSON content from data/HTTP/IPFS URIs
- **Event timeline** — Log Index, Event name, Signature, Topic0, Timestamp, Tx Hash. Expandable rows show raw event arguments as JSON.

---

### Analytics (`/analytics`)

**API:** `GET /v1/analytics/overview`

Deep-dive analytics with time-series charts, heuristics, and distribution data.

- **Global heuristics header** — Growth Velocity, Feedback Density, Dormant Agent Ratio, Response Engagement, Transfer Rate, Network Gini Coefficient
- **Primary charts** — Agent Registrations, Feedback Volume, Response Volume, Transfer Volume
- **Secondary charts** (collapsible) — Active Agents (30d), Client Growth, Responder Growth, Integrity Health, Agent Feedback Velocity
- **Revocation section** (collapsible) — Revocation Rate heuristic, Revocation Volume chart
- **Distribution tables** — Top 15 Agents by Feedback, Tag Heatmap, Endpoint Heatmap, Protocol Distribution, Time to First Feedback Distribution

---

### Trust Network (`/network`)

**API:** `GET /v1/network/graph`

Interactive force-directed graph visualization of agent trust relationships.

- **Network metrics** — Reciprocal Review Ratio, Isolated Cluster Share, Network Bridge Count
- **Graph visualization** — Sigma.js canvas with ForceAtlas2 layout, node dragging, edge hover tooltips (kind, weight, tx hash)
- **Edge table** — Source, Target, Kind, Weight, First Seen, Last Seen, Tx Hash. Agent nodes display JSON-derived names when available, falling back to "Agent <id>".
- **Node detail dialog** — Node ID, kind, degree, inbound/outbound counts, agent ID or address, first/last seen, edge kind breakdowns, top 12 connected nodes, metadata
- **Filters** — Minimum edge weight, time window (1-14 days), window end datetime, agent ID, address
- **Graph controls** — Ego-view depth (global/1-hop/2-hop), edge kind filters (Review, Registrant, Agent Review, Response), force layout parameters

---

### Search (`/search`)

**API:** `GET /v1/search`

Global search across all indexed data.

- **Input** — Free-text query (agent ID, address, tx hash, name, tag, endpoint)
- **Quick route matching** — Direct link if input matches an agent ID, address, or tx hash pattern
- **Results table** — Type, Title, Subtitle, Route link
- **Pagination** — 25 results per page

---

## URI Resolution

Agents and responses carry a resource URI that contains metadata (name, description, image, services, etc.) as JSON. The frontend resolves these URIs transparently across three scheme types.

### Supported Schemes

| Scheme | Example | Resolution |
|--------|---------|------------|
| `data:` | `data:application/json;base64,eyJuYW1l...` | Decoded client-side |
| `data:` (gzip) | `data:application/json;enc=gzip;base64,...` | Decompressed client-side via `DecompressionStream` |
| `http://` / `https://` | `https://example.com/agent.json` | Proxied server-side via `GET /v1/resolve/uri` |
| `ipfs://` | `ipfs://Qm.../metadata.json` | Proxied server-side via `GET /v1/resolve/uri` |

### Resolution Flow

1. **Classify** — `resolveAgentUri()` in `src/lib/uri-resolver.ts` parses the URI and determines the scheme. Data URIs with plain or base64 encoding are decoded synchronously. HTTP/IPFS URIs are classified but not fetched.
2. **Async decompress** — If the data URI includes `enc=gzip`, `resolveDataUriAsync()` decodes the base64 payload and pipes it through the browser `DecompressionStream` API to decompress gzip content.
3. **Server proxy** — HTTP and IPFS URIs are fetched through the backend at `GET /v1/resolve/uri?url=<encoded>`, which handles CORS and IPFS gateway resolution. The response is validated as `application/json`.
4. **Extract metadata** — `extractAgentUriMetadata()` in `src/lib/uri-metadata.ts` defensively extracts typed fields from the decoded JSON: `name`, `description`, `type`, `image`, `active`, `x402Support`, `erc8004Support`, `services`, `registrations`, `supportedTrusts`.
5. **Display** — Resolved JSON is rendered via `vue-json-pretty` in a modal overlay (`UriOverlay.vue`). Extracted metadata populates agent profile headers (name, avatar, description) and summary fields.

### Image Resolution

Agent images referenced in metadata are resolved separately:

- **Data URIs** (`data:image/png;base64,...`) render directly in an `<img>` tag
- **HTTP/IPFS URLs** are proxied through `GET /v1/resolve/image?url=<encoded>` to avoid CORS issues

Images that fail to load are hidden gracefully (no broken image icon).

### Where URIs Appear

- **Agent Profile** — Current agent URI is resolved on load; decoded JSON shown in the URI section, metadata populates the header
- **Dashboard Top Agents** — Each agent's URI is resolved to display name and avatar
- **Transaction Detail** — URI arguments in decoded function calls are clickable; opens the resolution overlay
- **Reputation tables** — Response URIs are clickable and open the overlay

---

## API Endpoint Summary

Every API call goes through the client at `src/lib/api-client.ts`.

| Client Method | HTTP Endpoint | Used By |
|---------------|---------------|---------|
| `getAnalyticsOverview()` | `GET /v1/analytics/overview` | Dashboard, Analytics |
| `getAgents()` | `GET /v1/agents` | Agent Directory |
| `getAgent(agentId)` | `GET /v1/agents/:agentId` | Agent Profile |
| `getReputation()` | `GET /v1/reputation` | Reputation Explorer |
| `getAgentReputation(agentId)` | `GET /v1/reputation/:agentId` | Agent Reputation |
| `getAddress(address)` | `GET /v1/address/:address` | Address Profile |
| `getTransaction(txHash)` | `GET /v1/transactions/:txHash` | Transaction Detail |
| `getNetworkGraph(params)` | `GET /v1/network/graph` | Trust Network |
| `search(params)` | `GET /v1/search` | Search |
| `resolveUri(url)` | `GET /v1/resolve/uri` | Dashboard, Agent Profile, Transaction Detail |
| `imageProxyUrl(url)` | `GET /v1/resolve/image` | Dashboard, Agent Profile |

---

## Prerequisites

- Node.js >= 20
- Yarn 1.x

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_SCANNER_API_BASE_URL` | `http://localhost:3000` | AgentIndex API base URL (build-time only) |

This is an Astro `PUBLIC_` variable — it is inlined into client JS at build time. For Docker, pass it as a build arg:

```bash
docker build --build-arg PUBLIC_SCANNER_API_BASE_URL=https://agentindex.space -t agentindex-web .
```

For local development, create a `.env` file:

```
PUBLIC_SCANNER_API_BASE_URL=http://localhost:3100
```

## Scripts

```bash
yarn dev           # Start dev server
yarn run check     # Astro + TypeScript type checking
yarn test          # Run tests (vitest)
yarn test:watch    # Run tests in watch mode
yarn test:coverage # Run tests with coverage
yarn build         # Production build
yarn preview       # Preview production build locally
```

## Docker

```bash
docker build --build-arg PUBLIC_SCANNER_API_BASE_URL=https://agentindex.space -t agentindex-web .
docker run -p 4321:4321 agentindex-web
```

The Astro standalone server listens on `0.0.0.0:4321` by default. Override with `HOST` and `PORT` environment variables.

## Architecture

- **Astro** handles routing, SSR, and the layout shell
- **Vue 3** components hydrate client-side via `client:load`
- **Vuetify 3** provides the component library with custom light/dark themes
- **Sigma.js + Graphology** power the trust network graph visualization
- The API client (`src/lib/api-client.ts`) communicates with the AgentIndex API

```
src/
├── components/
│   ├── analytics/       # Analytics deep-dive page
│   ├── address/         # Address profile page
│   ├── agents/          # Agent directory + profile pages
│   ├── dashboard/       # Dashboard overview page
│   ├── network/         # Trust network graph + controls
│   ├── reputation/      # Reputation explorer + agent reputation pages
│   ├── search/          # Global search page
│   ├── shared/          # Reusable components (GlobalNav, MetricTile, charts, UriOverlay)
│   └── transactions/    # Transaction detail page
├── layouts/             # Astro layout shell (theme, CSS tokens)
├── lib/                 # API client, theme utilities, URI resolution helpers
└── pages/               # Astro route definitions (.astro files)
```
