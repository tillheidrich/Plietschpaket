# Plietschpaket – one container, data in /data
FROM node:22-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9 AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts ./scripts
RUN node scripts/build-vendor.mjs && npm prune --omit=dev

FROM node:22-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates curl && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data && chown node:node /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public/vendor ./public/vendor
COPY --from=build /app/public/assets/fonts ./public/assets/fonts
COPY package.json ./
COPY h5p ./h5p
COPY src ./src
COPY desktop-extension ./desktop-extension
COPY public/index.html ./public/index.html
COPY public/assets/app.js public/assets/i18n.js public/assets/app.css public/assets/blockeditor.js public/assets/blockeditor.css public/assets/favicon.svg ./public/assets/
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
