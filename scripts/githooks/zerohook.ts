#!/usr/bin/env tsx
import { ZT, ZeroThrow, Result } from '../../packages/core/src/index';
import { collect } from '../../packages/core/src/combinators';
import { execCmd, execCmdInteractive } from '../lib/shared';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ESLint } from 'eslint';


type GitFile = {
  path: string;
  isPartiallyStaged: boolean;
};

type GitDiff = {
  file: string;
  diff: string;
};


// Get staged TypeScript files
function getStagedFiles(): ZeroThrow.Async<string[]> {
  return execCmd('git diff --cached --name-only --diff-filter=ACM')
    .map(output => output
      .split('\n')
      .filter(f => f && f.match(/\.(ts|tsx)$/))
    );
}

// Get staged TypeScript files that should be linted (using ESLint config)
async function getStagedFilesForLinting(): Promise<Result<string[]>> {
  const result = await execCmd('git diff --cached --name-only --diff-filter=ACM');
  if (!result.ok) return result;
  
  const allFiles = result.value
    .split('\n')
    .filter(f => f && f.match(/\.(ts|tsx|js|jsx)$/));
  
  if (allFiles.length === 0) return ZT.ok([]);
  
  // Create ESLint instance to check which files should be linted
  const eslint = new ESLint();
  const filesToLint: string[] = [];
  
  for (const file of allFiles) {
    const isIgnored = await eslint.isPathIgnored(file);
    if (!isIgnored) {
      filesToLint.push(file);
    }
  }
  
  return ZT.ok(filesToLint);
}

// Check if a file has unstaged changes
function hasUnstagedChanges(file: string): ZeroThrow.Async<boolean> {
  return execCmd('git diff --name-only')
    .map(output => {
      const unstagedFiles = output.split('\n').filter(Boolean);
      return unstagedFiles.includes(file);
    });
}

// Get diff for a specific file
function getFileDiff(file: string): ZeroThrow.Async<string> {
  return execCmd(`git diff "${file}"`);
}


// Run linter on staged files
function runLinter(files: string[]): ZeroThrow.Async<void> {
  if (files.length === 0) {
    return ZeroThrow.fromAsync(async () => ZT.ok(undefined));
  }
  
  const spinner = ora('Running linter...').start();
  
  // Separate src files from other files
  const srcFiles = files.filter(f => f.startsWith('src/'));
  const otherFiles = files.filter(f => !f.startsWith('src/'));
  
  // Build the linting pipeline
  return ZeroThrow.fromAsync(async () => ZT.ok(undefined))
    .andThen(() => {
      if (srcFiles.length === 0) return ZT.ok(undefined);
      
      spinner.text = 'Running strict linting on src files...';
      return execCmd(`pnpm exec eslint ${srcFiles.join(' ')}`)
        .void()
        .tapErr(() => {
          spinner.fail('Source file linting failed (strict mode)');
          console.error(chalk.red('\n❌ Source files must pass strict linting rules'));
        });
    })
    .andThen(() => {
      if (otherFiles.length === 0) return ZT.ok(undefined);
      
      spinner.text = 'Running linting on test/other files...';
      return execCmd(`pnpm exec eslint ${otherFiles.join(' ')}`)
        .void()
        .tapErr(() => {
          spinner.fail('Test/other file linting failed');
        });
    })
    .tap(() => spinner.succeed('Linting passed'));
}

// Handle interactive staging for a file
async function handleFileInteractive(file: string, diff: string): Promise<'staged' | 'skipped' | 'quit' | 'stage-all' | 'skip-all'> {
  console.log(`\n📄 File: ${chalk.yellow(file)}`);
  console.log('━'.repeat(50));
  console.log(diff);
  
  const { action } = await inquirer.prompt([{
    type: 'expand',
    name: 'action',
    message: `Stage unstaged changes in ${file}?`,
    choices: [
      { key: 'y', name: 'Stage this file', value: 'stage' },
      { key: 'n', name: 'Do not stage this file', value: 'skip' },
      { key: 'a', name: 'Stage this and all remaining files', value: 'stage-all' },
      { key: 'd', name: 'Do not stage this or any remaining files', value: 'skip-all' },
      { key: 's', name: 'Split into hunks', value: 'split' },
      { key: 'q', name: 'Quit', value: 'quit' },
    ],
  }]);
  
  switch (action) {
    case 'stage':
      const stageResult = await execCmd(`git add "${file}"`);
      if (!stageResult.ok) {
        console.error(chalk.red(`Failed to stage ${file}: ${stageResult.error.message}`));
        return 'quit';
      }
      console.log(chalk.green(`✅ Staged ${file}`));
      return 'staged';
      
    case 'skip':
      console.log(chalk.yellow(`⏭️  Skipped ${file}`));
      return 'skipped';
      
    case 'split':
      console.log(chalk.blue('\nEntering hunk-by-hunk staging mode...'));
      const patchResult = await execCmdInteractive(`git add -p "${file}"`);
      if (!patchResult.ok) {
        console.error(chalk.red(`Failed to patch stage: ${patchResult.error.message}`));
        return 'quit';
      }
      console.log(chalk.green(`✅ Finished patch staging for ${file}`));
      return 'staged';
      
    case 'stage-all':
      // Will be handled by caller
      return 'stage-all';
      
    case 'skip-all':
      // Will be handled by caller
      return 'skip-all';
      
    case 'quit':
      return 'quit';
      
    default:
      return 'quit';
  }
}

// Check partially staged files and collect them
function checkPartiallyStaged(files: string[]): ZeroThrow.Async<string[]> {
  // Map each file to a promise that checks if it has unstaged changes
  const checks = files.map(file => 
    hasUnstagedChanges(file)
      .map(unstaged => ({ file, unstaged }))
  );
  
  // Use collect to handle all results at once
  return ZeroThrow.fromAsync(async () => {
    const results = await Promise.all(checks);
    const collected = collect(results);
    
    if (!collected.ok) return collected;
    
    // Filter to only partially staged files
    const partiallyStaged = collected.value
      .filter(item => item.unstaged)
      .map(item => item.file);
      
    return ZT.ok(partiallyStaged);
  });
}

// Handle all partially staged files
function handlePartiallyStaged(files: string[]): ZeroThrow.Async<void> {
  if (files.length === 0) return ZeroThrow.enhance(Promise.resolve(ZT.ok(undefined)));
  
  console.log(chalk.yellow('⚠️  Detected partially staged files with unstaged changes:\n'));
  files.forEach(file => console.log(`  • ${file}`));
  console.log(chalk.gray('\nThe linter will check the staged version, not what\'s in your editor.'));
  
  return ZeroThrow.fromAsync(async () => {
    const { shouldReview } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldReview',
      message: 'Would you like to interactively handle unstaged changes?',
      default: true,
    }]);
    
    if (!shouldReview) return ZT.ok(undefined);
    
    let stageAll = false;
    let skipAll = false;
    
    for (const file of files) {
      if (stageAll) {
        const result = await execCmd(`git add "${file}"`)
          .tap(() => console.log(chalk.green(`✅ Staged ${file}`)))
          .tapErr(e => console.error(chalk.red(`Failed to stage ${file}: ${e.message}`)));
        if (!result.ok) return result.void();
        continue;
      }
      
      if (skipAll) {
        console.log(chalk.yellow(`⏭️  Skipped ${file}`));
        continue;
      }
      
      const diffResult = await getFileDiff(file)
        .tapErr(e => console.error(chalk.red(`Failed to get diff for ${file}: ${e.message}`)));
      if (!diffResult.ok) return diffResult.void();
      
      const action = await handleFileInteractive(file, diffResult.value);
      
      switch (action) {
        case 'quit':
          console.log(chalk.red('\n❌ Commit cancelled'));
          return ZT.err(new ZeroThrow.ZeroError('CANCELLED', 'User cancelled commit'));
        case 'stage-all':
          stageAll = true;
          const stageResult = await execCmd(`git add "${file}"`)
            .tap(() => console.log(chalk.green(`✅ Staged ${file}`)))
            .tapErr(e => console.error(chalk.red(`Failed to stage ${file}: ${e.message}`)));
          if (!stageResult.ok) return stageResult.void();
          break;
        case 'skip-all':
          skipAll = true;
          console.log(chalk.yellow(`⏭️  Skipped ${file}`));
          break;
      }
    }
    
    return ZT.ok(undefined);
  });
}

// Main pre-commit logic
async function main(): Promise<number> {
  console.log(chalk.blue('\n🚀 ZeroHook - Pre-commit checks\n'));
  
  const result = await getStagedFiles()
    .tapErr(e => console.error(chalk.red(`Failed to get staged files: ${e.message}`)))
    .andThen(files => {
      if (files.length === 0) {
        console.log(chalk.gray('No TypeScript files to check'));
        // Return success with void - no more work to do
        return ZeroThrow.fromAsync(async () => ZT.ok(undefined));
      }
      
      // Process files through the pipeline
      return checkPartiallyStaged(files)
        .andThen(partiallyStaged => handlePartiallyStaged(partiallyStaged))
        .andThen(() => ZeroThrow.fromAsync(async () => {
          const result = await getStagedFilesForLinting();
          if (!result.ok) {
            console.error(chalk.red(`Failed to get final staged files: ${result.error.message}`));
            return result;
          }
          return runLinter(result.value);
        }))
        .tap(() => {
          console.log(chalk.green('\n✨ Pre-commit checks passed! Proceeding with commit...\n'));
          if (process.env.ZEROHOOK_DEBUG) {
            console.log(chalk.gray('\n🚀 Powered by zerothrow - zero exceptions thrown'));
          }
        });
    });
  
  return result.ok ? 0 : 1;
}

// Run the hook
main().then(exitCode => process.exit(exitCode));