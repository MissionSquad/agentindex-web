FROM node:20-slim AS build

WORKDIR /app

ARG TARGETARCH
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn/$TARGETARCH

COPY package.json yarn.lock ./

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/$TARGETARCH,sharing=locked \
    corepack enable && yarn install --frozen-lockfile

COPY . .

ARG PUBLIC_SCANNER_API_BASE_URL=http://localhost:3100
ENV PUBLIC_SCANNER_API_BASE_URL=$PUBLIC_SCANNER_API_BASE_URL

RUN yarn build

# Remove devDependencies
RUN yarn install --frozen-lockfile --production --ignore-scripts

# Production stage
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
