FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install

# Install React testing dependencies
RUN pnpm install --save-dev \
    react@18 \
    react-dom@18 \
    @types/react@18 \
    @types/react-dom@18 \
    @testing-library/react \
    @testing-library/jest-dom \
    @testing-library/user-event \
    jsdom \
    vite \
    @vitejs/plugin-react

# Copy the ZeroThrow source
COPY src/ ./src/

# Copy React examples and tests
COPY examples/react/ ./examples/react/

# Copy test configuration
COPY examples/react/vitest.config.ts ./vitest.config.ts
COPY examples/react/tsconfig.json ./tsconfig.json

CMD ["pnpm", "test"]