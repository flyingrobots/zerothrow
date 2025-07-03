#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../src/index.js';
import { execCmd, execCmdInteractive } from './lib/shared.js';
import { checkDockerStatus, startDocker, isContainerRunning, stopContainer } from './lib/docker.js';
import chalk from 'chalk';
import ora from 'ora';
import { platform } from 'os';

interface TestRunnerOptions {
  includeIntegration?: boolean;
  coverage?: boolean;
  watch?: boolean;
  reporter?: string;
  pattern?: string;
}

async function runTests(options: TestRunnerOptions = {}): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const { 
    includeIntegration = false, 
    coverage = true, 
    watch = false,
    reporter = 'default',
    pattern
  } = options;

  console.log(chalk.blue('🧪 ZeroThrow Test Runner\n'));

  // Check if we need Docker for integration tests
  if (includeIntegration) {
    const isCI = process.env.CI === 'true';
    
    if (isCI) {
      // In CI, we use GitHub Actions services on Linux
      // Integration tests are skipped on macOS/Windows CI
      console.log(chalk.blue('🔧 Running in CI - using GitHub Actions PostgreSQL service'));
      console.log(chalk.gray('   PostgreSQL available at localhost:5432\n'));
      
      // Set environment variables for test utilities to use CI services
      process.env.ZEROTHROW_CI_MODE = 'true';
      process.env.ZEROTHROW_PG_HOST = 'localhost';
      process.env.ZEROTHROW_PG_PORT = '5432';
    } else {
      // Local development needs Docker
      const dockerStatus = await checkDockerStatus();
      if (!dockerStatus.ok) {
        return dockerStatus;
      }

      if (!dockerStatus.value.running) {
        console.log(chalk.yellow('⚠️  Docker is not running. Integration tests require Docker.'));
        
        if (platform() === 'darwin') {
          const spinner = ora('Starting Docker Desktop...').start();
          const startResult = await startDocker();
          if (!startResult.ok) {
            spinner.fail('Failed to start Docker');
            console.log(chalk.red('\n❌ Integration tests cannot run without Docker.'));
            console.log(chalk.gray('   Run unit tests only with: npm run test:unit'));
            return startResult;
          }
          spinner.succeed('Docker started successfully');
        } else {
          console.log(chalk.red('Please start Docker manually and try again.'));
          return ZT.err(new ZeroThrow.ZeroError('DOCKER_NOT_RUNNING', 'Docker is required for integration tests'));
        }
      }
      
      // Clean up any leftover test containers
      const cleanupSpinner = ora('Cleaning up test containers...').start();
      const psResult = await execCmd('docker ps -a --filter "name=zt_test_" --format "{{.Names}}"');
      if (psResult.ok && psResult.value.trim()) {
        const containers = psResult.value.trim().split('\n');
        for (const container of containers) {
          await stopContainer(container);
        }
      }
      cleanupSpinner.succeed('Test environment ready');
    }
  }

  // Build test command
  let testCmd = 'vitest run';
  if (watch) testCmd = 'vitest';
  if (coverage && !watch) testCmd += ' --coverage';
  if (reporter !== 'default') testCmd += ` --reporter=${reporter}`;

  // Add test pattern
  if (pattern) {
    testCmd += ` ${pattern}`;
  } else if (!includeIntegration) {
    // Exclude integration tests if not requested
    testCmd += ' --exclude="test/integration/**"';
  }

  console.log(chalk.gray(`Running: ${testCmd}\n`));

  // Run tests
  const testResult = await execCmdInteractive(testCmd);
  if (!testResult.ok) {
    return testResult;
  }

  // Clean up Docker containers after integration tests
  if (includeIntegration) {
    const cleanupResult = await execCmd('docker ps -a --filter "name=zt_test_" -q | xargs -r docker rm -f 2>/dev/null || true');
    if (!cleanupResult.ok) {
      console.log(chalk.yellow('⚠️  Warning: Failed to clean up some test containers'));
    }
  }

  return ZT.ok(undefined);
}

// CLI interface
async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const options: TestRunnerOptions = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--integration':
      case '-i':
        options.includeIntegration = true;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--reporter':
      case '-r':
        options.reporter = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
ZeroThrow Test Runner

Usage: test-runner [options] [pattern]

Options:
  -i, --integration    Include integration tests (requires Docker)
  --no-coverage        Disable coverage reporting
  -w, --watch          Run in watch mode
  -r, --reporter       Specify test reporter (default, dot, verbose, etc.)
  -h, --help           Show this help message

Examples:
  test-runner                     # Run unit tests only
  test-runner -i                  # Run all tests including integration
  test-runner test/result.test.ts # Run specific test file
  test-runner -w                  # Run in watch mode
`);
        return 0;
      default:
        if (!args[i].startsWith('-')) {
          options.pattern = args[i];
        }
    }
  }

  const result = await runTests(options);
  
  if (!result.ok) {
    console.error(chalk.red(`\n❌ Test run failed: ${result.error.message}`));
    return 1;
  }

  return 0;
}

// Export for programmatic use
export { runTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(process.exit);
}