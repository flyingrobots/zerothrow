FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install

# Install async patterns testing dependencies
RUN pnpm install --save-dev \
    @types/node \
    typescript \
    vitest

# Copy the ZeroThrow source
COPY src/ ./src/

# Copy async patterns example and tests
COPY examples/async-patterns.ts ./examples/async-patterns.ts
COPY examples/async-patterns/ ./examples/async-patterns/

# Copy test configuration
COPY examples/async-patterns/vitest.config.ts ./vitest.config.ts
COPY examples/async-patterns/tsconfig.json ./tsconfig.json

CMD ["pnpm", "test"]