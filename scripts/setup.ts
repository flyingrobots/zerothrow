#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../packages/core/src/index.js';
import { execCmd } from './lib/shared.js';
import { checkDockerStatus, getDockerInstallCommand } from './lib/docker.js';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

async function setupZeroThrow(): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  console.log(chalk.bold.blue(`
╔════════════════════════════════════════╗
║     🚀 ZeroThrow Setup Assistant 🚀    ║
╚════════════════════════════════════════╝
`));

  console.log(chalk.gray('This will help you set up your development environment.\n'));

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 22) {
    console.log(chalk.red(`❌ Node.js ${nodeVersion} detected. ZeroThrow requires Node.js 22.12.0 or higher.`));
    console.log(chalk.yellow('   Please upgrade Node.js: https://nodejs.org/'));
    return ZT.err(new ZeroThrow.ZeroError('NODE_VERSION_TOO_LOW', 'Node.js version too low'));
  }
  console.log(chalk.green(`✅ Node.js ${nodeVersion} detected`));

  // Install dependencies
  const depsSpinner = ora('Installing dependencies...').start();
  const npmResult = await execCmd('pnpm install');
  if (!npmResult.ok) {
    depsSpinner.fail('Failed to install dependencies');
    return npmResult;
  }
  depsSpinner.succeed('Dependencies installed');

  // Check Docker
  console.log(chalk.blue('\n🐋 Checking Docker...\n'));
  const dockerStatus = await checkDockerStatus();
  
  if (!dockerStatus.ok || !dockerStatus.value.installed) {
    console.log(chalk.yellow('⚠️  Docker is not installed.'));
    console.log(chalk.gray('   Docker is required for running integration tests.\n'));
    
    const { installDocker } = await inquirer.prompt([{
      type: 'confirm',
      name: 'installDocker',
      message: 'Would you like to install Docker now?',
      default: true
    }]);

    if (installDocker) {
      const installCmd = getDockerInstallCommand();
      console.log(chalk.gray(`\nTo install Docker, run:\n`));
      console.log(chalk.cyan(`  ${installCmd}\n`));
      
      if (installCmd.includes('brew')) {
        const { runInstall } = await inquirer.prompt([{
          type: 'confirm',
          name: 'runInstall',
          message: 'Run this command now?',
          default: true
        }]);

        if (runInstall) {
          const installSpinner = ora('Installing Docker...').start();
          const installResult = await execCmd(installCmd);
          if (!installResult.ok) {
            installSpinner.fail('Failed to install Docker');
            console.log(chalk.yellow('\nPlease install Docker manually and run setup again.'));
          } else {
            installSpinner.succeed('Docker installed successfully');
            console.log(chalk.green('✅ Docker is now installed!'));
            console.log(chalk.gray('   You may need to start Docker Desktop manually.'));
          }
        }
      }
    }
  } else if (!dockerStatus.value.running) {
    console.log(chalk.yellow('⚠️  Docker is installed but not running.'));
    console.log(chalk.gray('   Start Docker Desktop to run integration tests.'));
  } else {
    console.log(chalk.green('✅ Docker is installed and running'));
    if (dockerStatus.value.composeInstalled) {
      console.log(chalk.green('✅ Docker Compose is installed'));
    }
  }

  // Set up Git hooks
  console.log(chalk.blue('\n🪝 Setting up Git hooks...\n'));
  const hooksResult = await execCmd('pnpm run githooks');
  if (!hooksResult.ok) {
    console.log(chalk.yellow('⚠️  Failed to set up Git hooks'));
    console.log(chalk.gray('   Run "pnpm run githooks" manually to set them up.'));
  } else {
    console.log(chalk.green('✅ Git hooks installed'));
  }

  // Build the project
  console.log(chalk.blue('\n🔨 Building the project...\n'));
  const buildSpinner = ora('Running build...').start();
  const buildResult = await execCmd('pnpm run build');
  if (!buildResult.ok) {
    buildSpinner.fail('Build failed');
    return buildResult;
  }
  buildSpinner.succeed('Build completed');

  // Run tests
  console.log(chalk.blue('\n🧪 Running tests...\n'));
  const { runTests } = await inquirer.prompt([{
    type: 'list',
    name: 'runTests',
    message: 'Which tests would you like to run?',
    choices: [
      { name: 'Unit tests only (no Docker required)', value: 'unit' },
      { name: 'All tests including integration (Docker required)', value: 'all' },
      { name: 'Skip tests for now', value: 'skip' }
    ],
    default: 'unit'
  }]);

  if (runTests !== 'skip') {
    const testCmd = runTests === 'all' ? 'pnpm run test:all' : 'pnpm test';
    const testResult = await execCmd(testCmd);
    if (!testResult.ok) {
      console.log(chalk.yellow('\n⚠️  Some tests failed.'));
      console.log(chalk.gray('   This is expected if you have uncommitted changes.'));
    } else {
      console.log(chalk.green('\n✅ All tests passed!'));
    }
  }

  // Success!
  console.log(chalk.bold.green(`
╔════════════════════════════════════════╗
║        ✨ Setup Complete! ✨          ║
╚════════════════════════════════════════╝
`));

  console.log(chalk.white('You\'re ready to use ZeroThrow! Here are some useful commands:\n'));
  console.log(chalk.gray('  pnpm test              # Run unit tests'));
  console.log(chalk.gray('  pnpm run test:all      # Run all tests (requires Docker)'));
  console.log(chalk.gray('  pnpm run test:watch    # Run tests in watch mode'));
  console.log(chalk.gray('  pnpm run lint          # Run linter'));
  console.log(chalk.gray('  pnpm run bench        # Run benchmarks'));
  console.log(chalk.gray('  pnpm run build        # Build the project\n'));

  return ZT.ok(undefined);
}

// Main function
async function main(): Promise<number> {
  const result = await setupZeroThrow();
  
  if (!result.ok) {
    console.error(chalk.red(`\n❌ Setup failed: ${result.error.message}`));
    return 1;
  }

  return 0;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(process.exit);
}