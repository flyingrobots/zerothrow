// SPDX-License-Identifier: MIT
// Copyright (c) 2025 J. Kirby Ross

import { ZT, ZeroThrow } from '@zerothrow/core';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface ValidateOptions {
  fix?: boolean;
  staged?: boolean;
}

interface CheckResult {
  name: string;
  passed: boolean;
  output?: string;
  fixCommand?: string | undefined;
}

export async function validateCommand(options: ValidateOptions): Promise<ZeroThrow.Result<void, Error>> {
  console.log(chalk.bold.blue('\n🛡️  ZeroThrow Validation Suite\n'));

  const checks: CheckResult[] = [];
  
  // Run checks
  if (options.staged) {
    // Only validate staged files
    checks.push(await runCheck('Format check (staged)', 'prettier --check $(git diff --cached --name-only --diff-filter=ACM | grep -E "\\.(ts|tsx|js|jsx|json|md)$")', 'prettier --write'));
    checks.push(await runCheck('Lint check (staged)', 'eslint $(git diff --cached --name-only --diff-filter=ACM | grep -E "\\.(ts|tsx|js|jsx)$")', 'eslint --fix'));
  } else {
    // Full validation
    checks.push(await runCheck('Build', 'turbo run build', undefined, options.fix));
    checks.push(await runCheck('Lint', 'turbo run lint', 'turbo run lint -- --fix', options.fix));
    checks.push(await runCheck('Type check', 'turbo run type-check', undefined, options.fix));
    checks.push(await runCheck('Tests', 'turbo run test', undefined, options.fix));
    checks.push(await runCheck('Format', 'npm run format:check', 'npm run format', options.fix));
  }

  // Print results
  console.log(chalk.bold('\n📊 Results:\n'));
  
  let allPassed = true;
  for (const check of checks) {
    const icon = check.passed ? chalk.green('✅') : chalk.red('❌');
    const name = check.passed ? chalk.green(check.name) : chalk.red(check.name);
    console.log(`  ${icon} ${name}`);
    
    if (!check.passed) {
      allPassed = false;
      if (check.output) {
        console.log(chalk.gray(`     ${check.output.split('\n').slice(0, 3).join('\n     ')}`));
      }
      if (check.fixCommand && !options.fix) {
        console.log(chalk.yellow(`     💡 Fix: ${check.fixCommand}`));
      }
    }
  }

  if (!allPassed) {
    console.log(chalk.red('\n❌ Validation failed!\n'));
    
    if (!options.fix) {
      const fixableChecks = checks.filter(c => !c.passed && c.fixCommand);
      if (fixableChecks.length > 0) {
        console.log(chalk.yellow('💡 Run "zt validate --fix" to auto-fix some issues\n'));
      }
    }
    
    process.exit(1);
  }

  console.log(chalk.green('\n✅ All checks passed!\n'));
  return ZT.ok(undefined);
}

async function runCheck(
  name: string, 
  command: string, 
  fixCommand?: string,
  autoFix?: boolean
): Promise<CheckResult> {
  const spinner = ora(name).start();
  
  try {
    // If autoFix is enabled and we have a fix command, run it instead
    const cmdToRun = autoFix && fixCommand ? fixCommand : command;
    
    await runCommand(cmdToRun);
    spinner.succeed(name);
    return { name, passed: true };
  } catch (error: any) {
    spinner.fail(name);
    return { 
      name, 
      passed: false, 
      output: error.message || 'Command failed',
      fixCommand: fixCommand 
    };
  }
}

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      shell: true,
      stdio: 'pipe',
    });

    let output = '';
    child.stdout?.on('data', (data: any) => { output += data.toString(); });
    child.stderr?.on('data', (data: any) => { output += data.toString(); });

    child.on('exit', (code: any) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(output));
      }
    });

    child.on('error', (err: any) => {
      reject(err);
    });
  });
}