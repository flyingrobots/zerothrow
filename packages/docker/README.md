# @zerothrow/docker

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/docker)
![types](https://img.shields.io/npm/types/@zerothrow/docker)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-docker.webp" height="300" />
</div>

Zero-throw Docker utilities for testing and container management, with automatic error handling and recovery suggestions.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Tool](#cli-tool)
- [API](#api)
  - [Docker Status Functions](#docker-status-functions)
    - [`checkDockerStatus(): Promise<Result<DockerStatus, ZeroError>>`](#checkdockerstatus-promiseresultdockerstatus-zeroerror)
    - [`isRunningInDocker(): boolean`](#isrunningindocker-boolean)
    - [`startDocker(): Promise<Result<void, ZeroError>>`](#startdocker-promiseresultvoid-zeroerror)
  - [Container Management](#container-management)
    - [`isContainerRunning(name: string): Promise<Result<boolean, ZeroError>>`](#iscontainerrunningname-string-promiseresultboolean-zeroerror)
    - [`stopContainer(name: string): Promise<Result<void, ZeroError>>`](#stopcontainername-string-promiseresultvoid-zeroerror)
    - [`removeContainer(name: string): Promise<Result<void, ZeroError>>`](#removecontainername-string-promiseresultvoid-zeroerror)
  - [Disk Management](#disk-management)
    - [`checkDiskSpace(): Promise<Result<string, ZeroError>>`](#checkdiskspace-promiseresultstring-zeroerror)
    - [`pruneDocker(options?: DockerPruneOptions): Promise<Result<string, ZeroError>>`](#prunedockeroptions-dockerpruneoptions-promiseresultstring-zeroerror)
  - [Utility Functions](#utility-functions)
    - [`getDockerInstallCommand(): string`](#getdockerinstallcommand-string)
    - [`handleDockerError(error: ZeroError): Promise<Result<void, ZeroError>>`](#handledockererrorerror-zeroerror-promiseresultvoid-zeroerror)
    - [`execCmdInteractive(cmd: string): Promise<Result<void, ZeroError>>`](#execcmdinteractivecmd-string-promiseresultvoid-zeroerror)
- [Examples](#examples)
  - [Running Integration Tests with Docker](#running-integration-tests-with-docker)
  - [Error Handling with Recovery](#error-handling-with-recovery)
  - [Platform Detection](#platform-detection)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @zerothrow/docker @zerothrow/core
# or: pnpm add @zerothrow/docker @zerothrow/core
```

## Quick Start

```typescript
import { checkDockerStatus, startDocker, isContainerRunning } from '@zerothrow/docker';

// Check if Docker is installed and running
const status = await checkDockerStatus();
if (status.ok) {
  console.log('Docker version:', status.value.version);
  console.log('Docker running:', status.value.running);
}

// Start Docker if not running
if (!status.value.running) {
  const startResult = await startDocker();
  if (startResult.ok) {
    console.log('Docker started successfully');
  }
}

// Check if a container is running
const running = await isContainerRunning('my-postgres');
if (running.ok && running.value) {
  console.log('Container is running');
}
```

## CLI Tool

The package includes a CLI tool `zt-docker` for common Docker operations:

```bash
# Check Docker status
zt-docker status

# Start Docker daemon
zt-docker start

# Check disk usage
zt-docker disk

# Clean up Docker resources
zt-docker prune --all --volumes --force

# Stop a container
zt-docker stop my-container

# Remove a container
zt-docker remove my-container

# Run interactive Docker-based tests
zt-docker test
```

## API

### Docker Status Functions

#### `checkDockerStatus(): Promise<Result<DockerStatus, ZeroError>>`
Checks if Docker is installed, running, and if Docker Compose is available.

```typescript
interface DockerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  composeInstalled: boolean;
  composeVersion?: string;
  error?: ZeroError;
}
```

#### `isRunningInDocker(): boolean`
Detects if the current process is running inside a Docker container.

#### `startDocker(): Promise<Result<void, ZeroError>>`
Attempts to start the Docker daemon. Platform-specific:
- **macOS**: Opens Docker Desktop app and waits up to 30 seconds
- **Linux**: Uses systemctl to start the Docker service (requires sudo)
- **Windows**: Returns an error asking user to start Docker Desktop manually

### Container Management

#### `isContainerRunning(name: string): Promise<Result<boolean, ZeroError>>`
Checks if a container with the given name is currently running.

#### `stopContainer(name: string): Promise<Result<void, ZeroError>>`
Stops a running container by name.

#### `removeContainer(name: string): Promise<Result<void, ZeroError>>`
Forcefully removes a container by name (equivalent to `docker rm -f`).

### Disk Management

#### `checkDiskSpace(): Promise<Result<string, ZeroError>>`
Returns Docker disk usage information (equivalent to `docker system df`).

#### `pruneDocker(options?: DockerPruneOptions): Promise<Result<string, ZeroError>>`
Cleans up Docker resources with various options:

```typescript
interface DockerPruneOptions {
  all?: boolean;      // Remove all unused images, not just dangling
  volumes?: boolean;  // Also prune volumes
  force?: boolean;    // Skip confirmation prompts
}
```

### Utility Functions

#### `getDockerInstallCommand(): string`
Returns the platform-specific Docker installation command:
- **macOS**: `brew install --cask docker`
- **Linux**: `curl -fsSL https://get.docker.com | sh`
- **Windows**: `winget install Docker.DockerDesktop`
- **Other**: Returns Docker documentation URL

#### `handleDockerError(error: ZeroError): Promise<Result<void, ZeroError>>`
Analyzes Docker-related errors and provides actionable suggestions:
- Disk space issues: Suggests pruning commands
- Daemon not running: Attempts to start Docker
- Permission issues: Provides platform-specific fix instructions

#### `execCmdInteractive(cmd: string): Promise<Result<void, ZeroError>>`
Executes a shell command with inherited stdio, useful for interactive commands that need user input.

## Examples

### Running Integration Tests with Docker

The `test-docker.ts` script provides an interactive way to ensure Docker is ready before running integration tests:

```typescript
import runTests from '@zerothrow/docker/test-docker';

// Checks Docker status, offers to start it if needed,
// and runs integration tests when ready
await runTests();
```

### Error Handling with Recovery

```typescript
import { checkDockerStatus, handleDockerError, pruneDocker } from '@zerothrow/docker';

const status = await checkDockerStatus();
if (!status.ok) {
  // handleDockerError provides smart recovery suggestions
  const handled = await handleDockerError(status.error);
  if (!handled.ok) {
    console.error('Could not recover:', handled.error.message);
  }
}

// Handle disk space issues
const result = await someDockerOperation();
if (!result.ok && result.error.message.includes('no space left')) {
  console.log('Running out of disk space, cleaning up...');
  await pruneDocker({ all: true, volumes: true, force: true });
}
```

### Platform Detection

```typescript
import { isRunningInDocker, getDockerInstallCommand } from '@zerothrow/docker';

if (isRunningInDocker()) {
  console.log('Already in Docker, skipping container operations');
} else {
  console.log('To install Docker:', getDockerInstallCommand());
}
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT