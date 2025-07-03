#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../packages/core/src/index.js';
import { execCmdInteractive } from './lib/shared.js';
import { checkDockerStatus, startDocker, getDockerInstallCommand, handleDockerError, isRunningInDocker } from './lib/docker.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

async function main(): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const isTTY = process.stdout.isTTY && process.stdin.isTTY;
  const isCI = process.env.CI === 'true';
  
  console.log(chalk.blue.bold('\n🐳 ZeroThrow Docker-Based Test Runner\n'));
  
  // Check if we're already in Docker
  if (isRunningInDocker()) {
    console.log(chalk.yellow('📦 Running inside Docker container - skipping Docker checks\n'));
    console.log(chalk.blue('🚀 Running integration tests...\n'));
    return execCmdInteractive('npm run test:integration:raw');
  }
  
  // Non-interactive environment = fail fast
  if (!isTTY || isCI) {
    const statusResult = await checkDockerStatus();
    if (!statusResult.ok || !statusResult.value.running || !statusResult.value.composeInstalled) {
      console.error(chalk.red('❌ Docker is required for integration tests!'));
      console.error(chalk.red('   Running in non-interactive mode - cannot prompt for Docker setup.'));
      return ZT.err(
        new ZeroThrow.ZeroError('DOCKER_REQUIRED_NON_INTERACTIVE', 'Docker must be running in CI/non-TTY environments')
      );
    }
    // Docker is ready in non-interactive mode
    console.log(chalk.green('✅ Docker is ready (non-interactive mode)\n'));
    return execCmdInteractive('npm run test:integration:raw');
  }
  
  console.log(chalk.gray('Integration tests use real databases to ensure code quality.\n'));

  // Check Docker status
  const spinner = ora('Checking Docker status...').start();
  const statusResult = await checkDockerStatus();
  spinner.stop();

  if (!statusResult.ok) {
    console.error(chalk.red('Failed to check Docker status'));
    return statusResult;
  }

  const status = statusResult.value;

  // Docker not installed
  if (!status.installed) {
    console.log(chalk.yellow('⚠️  Docker is not installed!\n'));
    console.log('Docker is required to run integration tests with real databases.');
    console.log('This ensures your code works with actual PostgreSQL, Redis, etc.\n');
    
    const { shouldInstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Would you like instructions to install Docker?',
      default: true,
    }]);

    if (shouldInstall) {
      console.log(chalk.blue('\nTo install Docker:'));
      console.log(chalk.white(`  ${getDockerInstallCommand()}\n`));
      console.log(chalk.gray('Or download from: https://docs.docker.com/get-docker/\n'));
    }

    return ZT.err(
      new ZeroThrow.ZeroError('DOCKER_NOT_INSTALLED', 'Docker is required for integration tests')
    );
  }

  // Docker installed but not running
  if (!status.running) {
    console.log(chalk.yellow('⚠️  Docker is installed but not running!\n'));
    
    const { shouldStart } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldStart',
      message: 'Would you like to start Docker?',
      default: true,
    }]);

    if (shouldStart) {
      const startResult = await startDocker();
      if (!startResult.ok) {
        console.error(chalk.red('Failed to start Docker'));
        
        // Check if it's a known error we can help with
        const helpResult = await handleDockerError(startResult.error);
        if (!helpResult.ok) {
          return helpResult;
        }
      }
    } else {
      return ZT.err(
        new ZeroThrow.ZeroError('DOCKER_NOT_RUNNING', 'Docker must be running for integration tests')
      );
    }
  }

  // Docker Compose not installed
  if (!status.composeInstalled) {
    console.log(chalk.yellow('⚠️  Docker Compose is not available!\n'));
    console.log('Docker Compose is bundled with Docker Desktop on Mac/Windows.');
    console.log('On Linux, it should be included with recent Docker installations.\n');
    
    return ZT.err(
      new ZeroThrow.ZeroError('DOCKER_COMPOSE_MISSING', 'Docker Compose is required for integration tests')
    );
  }

  // All good - run tests
  console.log(chalk.green('✅ Docker is ready!\n'));
  console.log(chalk.gray(`Docker version: ${status.version}`));
  console.log(chalk.gray(`Compose version: ${status.composeVersion}\n`));

  const { runTests } = await inquirer.prompt([{
    type: 'confirm',
    name: 'runTests',
    message: 'Run integration tests now?',
    default: true,
  }]);

  if (!runTests) {
    console.log(chalk.gray('\nTests cancelled by user'));
    return ZT.ok(undefined);
  }

  console.log(chalk.blue('\n🚀 Running integration tests...\n'));
  
  // Run vitest with integration tests
  return execCmdInteractive('npm test -- test/integration/');
}

// Run the main function
main().then(result => {
  if (!result.ok) {
    console.error(chalk.red('\n❌ Integration tests failed:'));
    console.error(chalk.red(`   ${result.error.code}: ${result.error.message}`));
    if (result.error.context) {
      const ctx = result.error.context as any;
      if (ctx.suggestion) {
        console.log(chalk.yellow(`\n💡 Suggestion: ${ctx.suggestion}`));
      }
    }
    process.exit(1);
  }
});