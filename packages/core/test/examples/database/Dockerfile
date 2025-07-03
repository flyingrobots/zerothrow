FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Install database testing dependencies
RUN npm install --save-dev \
    sqlite3 \
    mongodb \
    @types/node \
    typescript \
    vitest

# Copy the ZeroThrow source
COPY src/ ./src/

# Copy database examples and tests
COPY examples/database/ ./examples/database/

# Copy test configuration
COPY examples/database/vitest.config.ts ./vitest.config.ts
COPY examples/database/tsconfig.json ./tsconfig.json

CMD ["npm", "test"]