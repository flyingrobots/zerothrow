FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Install framework testing dependencies
RUN npm install --save-dev \
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

CMD ["npm", "test"]