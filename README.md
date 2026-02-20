# AgentIndex Frontend

Astro SSR + Vue 3 + Vuetify 3 frontend for [agentindex.space](https://agentindex.space).

## Routes

| Path | Description |
|------|-------------|
| `/` | Dashboard with ecosystem metrics and top agents |
| `/agents` | Paginated agent registry |
| `/agents/[agentId]` | Agent profile (metadata, URI, activity timeline) |
| `/reputation` | Global feedback and response explorer |
| `/reputation/[agentId]` | Agent-scoped reputation activity |
| `/address/[address]` | Wallet-centric activity profile |
| `/tx/[txHash]` | Decoded transaction detail (envelope, call, events) |
| `/analytics` | Ecosystem analytics and heuristics |
| `/network` | Trust network graph explorer |
| `/search` | Global search across agents, addresses, tx hashes, tags, and endpoints |

## Prerequisites

- Node.js >= 20
- Yarn 1.x

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_SCANNER_API_BASE_URL` | `http://localhost:3000` | AgentIndex API base URL |

Create a `.env` file in the project root:

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
docker build -t agentindex-web .
docker run -p 4321:4321 agentindex-web
```

The Astro standalone server listens on `0.0.0.0:4321` by default. Override with `HOST` and `PORT` environment variables.

## Architecture

- **Astro** handles routing, SSR, and the layout shell
- **Vue 3** components hydrate client-side via `client:load`
- **Vuetify 3** provides the component library with custom light/dark themes
- **Sigma.js + Graphology** power the trust network graph visualization
- The API client (`src/lib/api-client.ts`) communicates with the AgentIndex API
