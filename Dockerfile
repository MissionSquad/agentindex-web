FROM node:20-slim AS build

WORKDIR /app

ARG TARGETARCH
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn/$TARGETARCH

COPY package.json yarn.lock ./

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/$TARGETARCH,sharing=locked \
    corepack enable && yarn install --frozen-lockfile

COPY . .
RUN yarn build

# Production stage — Astro standalone server only needs the dist output
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/dist ./dist

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
