FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install

# Install framework testing dependencies
RUN pnpm install --save-dev \
    @types/node \
    @types/react \
    @types/react-dom \
    react \
    react-dom \
    typescript \
    vitest

# Copy the ZeroThrow source
COPY src/ ./src/

# Copy framework examples and tests
COPY examples/frameworks/ ./examples/frameworks/

# Copy test configuration
COPY examples/frameworks/vitest.config.ts ./vitest.config.ts
COPY examples/frameworks/tsconfig.json ./tsconfig.json

CMD ["pnpm", "test"]