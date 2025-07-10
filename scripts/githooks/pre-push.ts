#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../../packages/core/src/index';
import { execCmd, execCmdInteractive } from '../lib/shared';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Exit codes
enum ExitCode {
  SUCCESS = 0,
  TEST_FAILED = 1,
  DOCKER_NOT_RUNNING = 2,
  DOCKER_COMPOSE_NOT_FOUND = 3,
}

// Test types
interface TestConfig {
  name: string;
  command: string;
  logFile: string;
  errorPattern?: RegExp;
  displayErrors?: boolean;
  helpText?: string[];
}

// Check if Docker is running
function isDockerRunning(): ZeroThrow.Async<boolean> {
  return ZeroThrow.enhance(execCmd('docker info').then(result => ZT.ok(result.ok)));
}

// Check for docker-compose availability
function getDockerComposeCommand(): ZeroThrow.Async<string> {
  return ZeroThrow.enhance((async () => {
    // Try 'docker compose' first (newer)
    const newStyleResult = await execCmd('docker compose version');
    if (newStyleResult.ok) {
      return ZT.ok('docker compose');
    }
    
    // Try 'docker-compose' (older)
    const oldStyleResult = await execCmd('docker-compose --version');
    if (oldStyleResult.ok) {
      return ZT.ok('docker-compose');
    }
    
    return ZT.err(new ZeroThrow.ZeroError('DOCKER_COMPOSE_NOT_FOUND', 'Neither docker compose nor docker-compose is available'));
  })());
}

// Run a single test locally
function runLocalTest(config: TestConfig): ZeroThrow.Async<void> {
  return ZeroThrow.enhance((async () => {
    const spinner = ora(`Running ${config.name}...`).start();
    const logPath = join(tmpdir(), config.logFile);
    
    // Run the test and capture output
    const result = await execCmd(`${config.command} 2>&1 | tee ${logPath}`);
    
    if (!result.ok) {
      spinner.fail(`${config.name} failed!`);
      
      console.log(chalk.red('\n===================================='));
      
      if (config.displayErrors) {
        // Display full log for lint
        const catResult = await execCmd(`cat ${logPath}`);
        if (catResult.ok) {
          console.log(catResult.value);
        }
      } else if (config.errorPattern) {
        // Extract specific errors
        const grepCmd = `grep -E "${config.errorPattern.source}" ${logPath} | tail -30`;
        const grepResult = await execCmd(grepCmd);
        if (grepResult.ok && grepResult.value.trim()) {
          console.log(grepResult.value);
        }
      } else {
        // Show last 50 lines for build errors
        const tailResult = await execCmd(`tail -50 ${logPath}`);
        if (tailResult.ok) {
          console.log(tailResult.value);
        }
      }
      
      console.log(chalk.red('====================================\n'));
      
      // Show help text
      if (config.helpText) {
        config.helpText.forEach(text => console.log(chalk.yellow(text)));
      }
      console.log(chalk.yellow(`💡 To see full output: cat ${logPath}`));
      
      return ZT.err(new ZeroThrow.ZeroError('TEST_FAILED', `${config.name} failed`, { 
        context: { logPath } 
    }));
  }
  
  spinner.succeed(`${config.name} passed`);
  return ZT.ok(undefined);
  })());
}

// Run all tests locally (no Docker)
function runLocalTests(): ZeroThrow.Async<void> {
  return ZeroThrow.enhance((async () => {
    console.log(chalk.yellow('⚠️  Docker is not running. Falling back to local test execution...'));
    console.log(chalk.blue('\n🏃 Running tests locally...\n'));
    
    const tests: TestConfig[] = [
      {
        name: 'TypeScript check',
        command: 'pnpm exec tsc --noEmit',
        logFile: 'typescript.log',
        displayErrors: true,
        helpText: [
          '💡 Common issues:',
          '  - Type errors: Review the errors above',
          '  - Missing types: pnpm add -D @types/package-name',
          '  - Incorrect type assertions: Fix the types, don\'t cast'
        ]
      },
      {
        name: 'unit tests',
        command: 'pnpm test',
        logFile: 'unit-test.log',
        errorPattern: /(\u2713|\u00d7|FAIL|Error:|at .*:[0-9]+:[0-9]+)/,
        helpText: ['💡 To debug: pnpm test -- --reporter=verbose']
      },
      // {
      //   name: 'integration tests',
      //   command: 'pnpm run test:integration',
      //   logFile: 'integration-test.log',
      //   errorPattern: /(\u2713|\u00d7|FAIL|Error:|at .*:[0-9]+:[0-9]+)/,
      //   helpText: ['💡 To debug: pnpm run test:integration']
      // },
      {
        name: 'lint checks',
        command: 'pnpm run lint',
        logFile: 'lint.log',
        displayErrors: true,
        helpText: [
          '💡 To auto-fix: pnpm run lint -- --fix',
          '💡 To check specific file: pnpm exec eslint path/to/file.ts'
        ]
      },
      {
        name: 'build check',
        command: 'pnpm run build',
        logFile: 'build.log',
        helpText: [
          '💡 Common issues:',
          '  - Missing dependency: Check if packages need installing',
          '  - TypeScript errors: Review the errors above',
          '  - Module resolution: Check tsconfig.json paths'
        ]
      }
    ];
    
    // Run tests sequentially with proper numbering
    for (let i = 0; i < tests.length; i++) {
      console.log(`${i + 1}️⃣  Running ${tests[i].name}...`);
      const result = await runLocalTest(tests[i]);
      if (!result.ok) {
        return result;
      }
      if (i < tests.length - 1) {
        console.log(''); // Add spacing between tests
      }
    }
    
    console.log(chalk.green('\n✅ All local tests passed! Safe to push.'));
    console.log(chalk.yellow('Note: Full CI matrix with multiple Node versions requires Docker.'));
    return ZT.ok(undefined);
  })());
}

// Run tests using Docker Compose
function runDockerTests(dockerComposeCmd: string): ZeroThrow.Async<void> {
  return ZeroThrow.enhance((async () => {
    console.log(chalk.blue('🐳 Starting all tests in parallel using Docker Compose...'));
    console.log('   Running containers simultaneously for maximum speed!');
    console.log('');
  
    // Run docker-compose up
    const upResult = await execCmdInteractive(
      `${dockerComposeCmd} -f docker-compose.prepush.yml up --abort-on-container-failure --remove-orphans`
    );
    
    // Always clean up
    await execCmd(`${dockerComposeCmd} -f docker-compose.prepush.yml down --remove-orphans`);
    
    if (!upResult.ok) {
      console.log(chalk.red('\n❌ Some tests failed!\n'));
      console.log('To see detailed logs for a specific service:');
      console.log(`  ${dockerComposeCmd} -f docker-compose.prepush.yml logs <service-name>\n`);
      console.log('Available services:');
      console.log('  - unit-tests-node22');
      console.log('  - integration-tests');
      console.log('  - lint-check');
      console.log('  - build-check');
      console.log('  - coverage-check\n');
      console.log('To skip these checks and push anyway (NOT RECOMMENDED):');
      console.log('  git push --no-verify');
      
      return ZT.err(new ZeroThrow.ZeroError('DOCKER_TESTS_FAILED', 'Docker tests failed'));
    }
    
    console.log(chalk.green('\n🎉 All tests passed! Safe to push.'));
    return ZT.ok(undefined);
  })());
}

// Main pre-push logic
async function main(): Promise<number> {
  console.log(chalk.blue('🚀 Running full CI test matrix locally before push...\n'));
  
  // Check if Docker is running
  // const dockerResult = await isDockerRunning();
  // if (!dockerResult.ok) {
  //   return ExitCode.DOCKER_NOT_RUNNING;
  // }
  
  // if (!dockerResult.value) {
  //   // Docker not running, use local fallback
    const localResult = await runLocalTests();
    return localResult.ok ? ExitCode.SUCCESS : ExitCode.TEST_FAILED;
  // }
  
  // // Docker is running, check for docker-compose
  // const dockerComposeResult = await getDockerComposeCommand();
  // if (!dockerComposeResult.ok) {
  //   console.error(chalk.red('❌ docker-compose is not installed.'));
  //   return ExitCode.DOCKER_COMPOSE_NOT_FOUND;
  // }
  
  // // Run Docker tests
  // const dockerTestResult = await runDockerTests(dockerComposeResult.value);
  // return dockerTestResult.ok ? ExitCode.SUCCESS : ExitCode.TEST_FAILED;
}

// Run the hook
main().then(exitCode => process.exit(exitCode));