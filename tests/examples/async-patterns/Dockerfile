FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Install async patterns testing dependencies
RUN npm install --save-dev \
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

CMD ["npm", "test"]