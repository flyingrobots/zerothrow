#!/usr/bin/env node
/**
 * @zerothrow/docker CLI
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2025 J. Kirby Ross
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { 
  checkDockerStatus, 
  startDocker, 
  pruneDocker,
  checkDiskSpace,
  isRunningInDocker,
  stopContainer,
  removeContainer
} from './index.js';

const program = new Command();

program
  .name('zt-docker')
  .description('Zero-throw Docker utilities')
  .version('0.1.0');

program
  .command('status')
  .description('Check Docker installation and status')
  .action(async () => {
    const spinner = ora('Checking Docker status...').start();
    
    const result = await checkDockerStatus();
    
    if (!result.ok) {
      spinner.fail(chalk.red('Docker check failed'));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    const status = result.value;
    spinner.stop();
    
    console.log(chalk.blue.bold('\n🐳 Docker Status\n'));
    
    if (status.installed) {
      console.log(chalk.green('✓ Docker installed'));
      if (status.version) console.log(chalk.gray(`  Version: ${status.version}`));
    } else {
      console.log(chalk.red('✗ Docker not installed'));
    }
    
    if (status.running) {
      console.log(chalk.green('✓ Docker daemon running'));
    } else {
      console.log(chalk.red('✗ Docker daemon not running'));
    }
    
    if (status.composeInstalled) {
      console.log(chalk.green('✓ Docker Compose installed'));
      if (status.composeVersion) console.log(chalk.gray(`  Version: ${status.composeVersion}`));
    } else {
      console.log(chalk.yellow('⚠ Docker Compose not installed'));
    }
    
    if (isRunningInDocker()) {
      console.log(chalk.cyan('\n📦 Running inside Docker container'));
    }
  });

program
  .command('start')
  .description('Start Docker daemon')
  .action(async () => {
    if (isRunningInDocker()) {
      console.log(chalk.yellow('📦 Already running inside Docker container'));
      return;
    }
    
    const spinner = ora('Starting Docker...').start();
    const result = await startDocker();
    
    if (!result.ok) {
      spinner.fail(chalk.red('Failed to start Docker'));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    spinner.succeed(chalk.green('Docker started successfully'));
  });

program
  .command('disk')
  .description('Check Docker disk usage')
  .action(async () => {
    const spinner = ora('Analyzing Docker disk usage...').start();
    const result = await checkDiskSpace();
    
    if (!result.ok) {
      spinner.fail(chalk.red('Failed to check disk usage'));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    spinner.stop();
    console.log(chalk.blue.bold('\n💾 Docker Disk Usage\n'));
    console.log(result.value);
  });

program
  .command('prune')
  .description('Clean up Docker resources')
  .option('-a, --all', 'Remove all unused images, not just dangling ones')
  .option('-v, --volumes', 'Prune volumes')
  .option('-f, --force', 'Do not prompt for confirmation')
  .action(async (options) => {
    const spinner = ora('Pruning Docker resources...').start();
    const result = await pruneDocker(options);
    
    if (!result.ok) {
      spinner.fail(chalk.red('Failed to prune Docker'));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    spinner.succeed(chalk.green('Docker resources pruned successfully'));
    console.log(chalk.gray(result.value));
  });

program
  .command('stop <container>')
  .description('Stop a running container')
  .action(async (container) => {
    const spinner = ora(`Stopping container ${container}...`).start();
    const result = await stopContainer(container);
    
    if (!result.ok) {
      spinner.fail(chalk.red(`Failed to stop container ${container}`));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    spinner.succeed(chalk.green(`Container ${container} stopped`));
  });

program
  .command('remove <container>')
  .description('Remove a container')
  .action(async (container) => {
    const spinner = ora(`Removing container ${container}...`).start();
    const result = await removeContainer(container);
    
    if (!result.ok) {
      spinner.fail(chalk.red(`Failed to remove container ${container}`));
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
    
    spinner.succeed(chalk.green(`Container ${container} removed`));
  });

program
  .command('test')
  .description('Run Docker-based tests interactively')
  .action(async () => {
    // Import and run the test-docker script
    const { default: runTests } = await import('./test-docker.js');
    await runTests();
  });

program.parse();