FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install

# Install Node.js testing dependencies
RUN pnpm install --save-dev \
    express \
    fastify \
    @types/express \
    @types/node \
    typescript \
    vitest \
    supertest \
    @types/supertest

# Copy the ZeroThrow source
COPY src/ ./src/

# Copy Node.js examples and tests
COPY examples/node/ ./examples/node/

# Copy test configuration
COPY examples/node/vitest.config.ts ./vitest.config.ts
COPY examples/node/tsconfig.json ./tsconfig.json

CMD ["pnpm", "test"]