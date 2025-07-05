# @zerothrow/docker

> Zero-throw Docker utilities for testing and container management

[![npm version](https://img.shields.io/npm/v/@zerothrow/docker.svg)](https://www.npmjs.com/package/@zerothrow/docker)
[![npm downloads](https://img.shields.io/npm/dm/@zerothrow/docker.svg)](https://www.npmjs.com/package/@zerothrow/docker)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

@zerothrow/docker provides Zero-throw Result-based APIs for Docker operations, making container management and Docker-based testing more reliable and developer-friendly.

Part of the [ZeroThrow ecosystem](../../README.md#ecosystem) 🎯

## 📦 Installation

```bash
npm install @zerothrow/docker @zerothrow/core
# or
yarn add @zerothrow/docker @zerothrow/core
# or
pnpm add @zerothrow/docker @zerothrow/core
```

## 🎯 Features

- **Zero-throw Docker APIs** - All operations return `Result<T, E>` types
- **Platform-aware** - Smart handling for macOS, Linux, and Windows
- **Interactive CLI** - User-friendly prompts for Docker setup
- **CI-friendly** - Fails fast in non-interactive environments
- **Comprehensive utilities** - Status checks, cleanup, container management

## 💻 CLI Usage

### Standalone CLI

```bash
# Check Docker status
npx @zerothrow/docker status

# Start Docker daemon
npx @zerothrow/docker start

# Check disk usage
npx @zerothrow/docker disk

# Clean up resources
npx @zerothrow/docker prune --all --volumes

# Run interactive tests
npx @zerothrow/docker test
```

### With ZT CLI

```bash
# Once integrated with zt-cli
zt docker status
zt docker prune
```

## 🔧 API Usage

```typescript
import { 
  checkDockerStatus,
  startDocker,
  pruneDocker,
  isRunningInDocker,
  handleDockerError
} from '@zerothrow/docker';

// Check Docker status
const status = await checkDockerStatus();
if (status.isErr()) {
  console.error('Docker check failed:', status.error);
  return;
}

if (!status.value.running) {
  // Try to start Docker
  const startResult = await startDocker();
  if (startResult.isErr()) {
    // Get platform-specific help
    const suggestion = handleDockerError(startResult.error);
    console.error(suggestion);
  }
}

// Clean up Docker resources
const pruneResult = await pruneDocker({ 
  all: true,      // Remove all unused images
  volumes: true,  // Also prune volumes
  force: true     // Don't prompt
});

// Check if running inside container
if (isRunningInDocker()) {
  console.log('Running inside Docker container');
}
```

## 📖 API Reference

### Status & Checks

- `checkDockerStatus()` - Get Docker installation and runtime status
- `isRunningInDocker()` - Detect if code is running in a container
- `checkDiskSpace()` - Analyze Docker disk usage

### Container Management

- `startDocker()` - Start Docker daemon (platform-specific)
- `stopContainer(name)` - Stop a running container
- `removeContainer(name)` - Remove a container
- `isContainerRunning(name)` - Check container status

### Cleanup

- `pruneDocker(options)` - Clean up Docker resources
  - `all` - Remove all unused images
  - `volumes` - Also prune volumes
  - `force` - Skip confirmation

### Error Handling

- `handleDockerError(error)` - Get platform-specific suggestions
- `getDockerInstallCommand()` - Get installation instructions

## 🧪 Testing Helper

The package includes a special test runner for Docker-based integration tests:

```typescript
// In your test script
import runTests from '@zerothrow/docker/test-docker';

await runTests(); // Interactive Docker setup and test execution
```

## 🏗️ Architecture

All functions follow Zero-throw patterns:
- Return `Result<T, ZeroError>` types
- Never throw exceptions
- Provide detailed error context
- Include helpful error recovery suggestions

## 📚 More Information

- [ZeroThrow Documentation](https://github.com/zerothrow/zerothrow)
- [API Reference](https://github.com/zerothrow/zerothrow/docs/api/docker)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## 📄 License

MIT © J. Kirby Ross

---

Part of the [ZeroThrow](https://github.com/zerothrow/zerothrow) ecosystem 🎯