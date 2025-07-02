#!/usr/bin/env tsx
import { Result, ok, err, ZeroError } from '../../src/index';
import { execCmd, execCmdInteractive } from '../lib/shared';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';


type GitFile = {
  path: string;
  isPartiallyStaged: boolean;
};

type GitDiff = {
  file: string;
  diff: string;
};


// Get staged TypeScript files
async function getStagedFiles(): Promise<Result<string[], ZeroError>> {
  const result = await execCmd('git diff --cached --name-only --diff-filter=ACM');
  if (!result.ok) return result;
  
  const files = result.value
    .split('\n')
    .filter(f => f && f.match(/\.(ts|tsx)$/));
    
  return ok(files);
}

// Check if a file has unstaged changes
async function hasUnstagedChanges(file: string): Promise<Result<boolean, ZeroError>> {
  const result = await execCmd('git diff --name-only');
  if (!result.ok) return result;
  
  const unstagedFiles = result.value.split('\n').filter(Boolean);
  return ok(unstagedFiles.includes(file));
}

// Get diff for a specific file
async function getFileDiff(file: string): Promise<Result<string, ZeroError>> {
  return execCmd(`git diff "${file}"`);
}

// Run tests
async function runTests(): Promise<Result<void, ZeroError>> {
  const spinner = ora('Running tests...').start();
  
  const result = await execCmd('npm test');
  
  if (!result.ok) {
    spinner.fail('Tests failed');
    return result;
  }
  
  spinner.succeed('Tests passed');
  return ok(undefined);
}

// Run linter on staged files
async function runLinter(files: string[]): Promise<Result<void, ZeroError>> {
  if (files.length === 0) return ok(undefined);
  
  const spinner = ora('Running linter...').start();
  
  const result = await execCmd(`npx eslint --max-warnings 0 ${files.join(' ')}`);
  
  if (!result.ok) {
    spinner.fail('Linting failed');
    console.error(result.error.message);
    return err(result.error);
  }
  
  spinner.succeed('Linting passed');
  return ok(undefined);
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

// Main pre-commit logic
async function main(): Promise<number> {
  console.log(chalk.blue('\n🚀 ZeroHook - Pre-commit checks\n'));
  
  // Run tests first
  const testResult = await runTests();
  if (!testResult.ok) {
    console.error(chalk.red('\n❌ Tests must pass before committing'));
    return 1;
  }
  
  // Get staged files
  const stagedFilesResult = await getStagedFiles();
  if (!stagedFilesResult.ok) {
    console.error(chalk.red(`Failed to get staged files: ${stagedFilesResult.error.message}`));
    return 1;
  }
  
  const stagedFiles = stagedFilesResult.value;
  if (stagedFiles.length === 0) {
    console.log(chalk.gray('No TypeScript files to check'));
    return 0;
  }
  
  // Check for partially staged files
  const partiallyStaged: string[] = [];
  for (const file of stagedFiles) {
    const hasUnstagedResult = await hasUnstagedChanges(file);
    if (!hasUnstagedResult.ok) {
      console.error(chalk.red(`Failed to check ${file}: ${hasUnstagedResult.error.message}`));
      return 1;
    }
    
    if (hasUnstagedResult.value) {
      partiallyStaged.push(file);
    }
  }
  
  // Handle partially staged files
  if (partiallyStaged.length > 0) {
    console.log(chalk.yellow('⚠️  Detected partially staged files with unstaged changes:\n'));
    partiallyStaged.forEach(file => console.log(`  • ${file}`));
    console.log(chalk.gray('\nThe linter will check the staged version, not what\'s in your editor.'));
    
    const { shouldReview } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldReview',
      message: 'Would you like to interactively handle unstaged changes?',
      default: true,
    }]);
    
    if (shouldReview) {
      let stageAll = false;
      let skipAll = false;
      
      for (const file of partiallyStaged) {
        if (stageAll) {
          const stageResult = await execCmd(`git add "${file}"`);
          if (!stageResult.ok) {
            console.error(chalk.red(`Failed to stage ${file}: ${stageResult.error.message}`));
            return 1;
          }
          console.log(chalk.green(`✅ Staged ${file}`));
          continue;
        }
        
        if (skipAll) {
          console.log(chalk.yellow(`⏭️  Skipped ${file}`));
          continue;
        }
        
        const diffResult = await getFileDiff(file);
        if (!diffResult.ok) {
          console.error(chalk.red(`Failed to get diff for ${file}: ${diffResult.error.message}`));
          return 1;
        }
        
        const result = await handleFileInteractive(file, diffResult.value);
        
        switch (result) {
          case 'quit':
            console.log(chalk.red('\n❌ Commit cancelled'));
            return 1;
          case 'stage-all':
            stageAll = true;
            const stageResult = await execCmd(`git add "${file}"`);
            if (!stageResult.ok) {
              console.error(chalk.red(`Failed to stage ${file}: ${stageResult.error.message}`));
              return 1;
            }
            console.log(chalk.green(`✅ Staged ${file}`));
            break;
          case 'skip-all':
            skipAll = true;
            console.log(chalk.yellow(`⏭️  Skipped ${file}`));
            break;
        }
      }
    }
  }
  
  // Re-get staged files after potential changes
  const finalStagedResult = await getStagedFiles();
  if (!finalStagedResult.ok) {
    console.error(chalk.red(`Failed to get final staged files: ${finalStagedResult.error.message}`));
    return 1;
  }
  
  // Run linter
  const lintResult = await runLinter(finalStagedResult.value);
  if (!lintResult.ok) {
    return 1;
  }
  
  console.log(chalk.green('\n✨ Pre-commit checks passed! Proceeding with commit...\n'));
  
  // Show that we use zerothrow - no try/catch blocks in the entire codebase!
  if (process.env.ZEROHOOK_DEBUG) {
    console.log(chalk.gray('\n🚀 Powered by zerothrow - zero exceptions thrown'));
  }
  
  return 0;
}

// Run the hook
main().then(exitCode => process.exit(exitCode));