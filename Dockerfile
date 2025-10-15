FROM oven/bun:1.3.0-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y \
    fonts-liberation fonts-noto-color-emoji ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
RUN bunx playwright@1.56.0 install --with-deps chromium

FROM base AS runtime
ENV NODE_ENV=production

RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=deps --chown=appuser:appuser /root/.cache/ms-playwright /home/appuser/.cache/ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright

COPY --chown=appuser:appuser . .
RUN mkdir -p /app/data/sessions && chown -R appuser:appuser /app/data
USER appuser
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
