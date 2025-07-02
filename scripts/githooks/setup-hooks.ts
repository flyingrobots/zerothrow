#!/usr/bin/env tsx
import { existsSync, mkdirSync, chmodSync } from 'fs';
import * as path from 'path';
import { Result, ok, err, ZeroError } from '../../src/index';
import { execCmd, readJsonFile, writeJsonFile, fileExists, readFile, writeFile } from '../lib/shared';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Helper functions specific to setup-hooks

function findProjectRoot(): Result<string, ZeroError> {
  let currentDir = process.cwd();
  
  while (currentDir !== '/') {
    if (existsSync(path.join(currentDir, 'package.json'))) {
      return ok(currentDir);
    }
    currentDir = path.dirname(currentDir);
  }
  
  return err(new ZeroError('NOT_NODE_PROJECT', 'Not in a Node.js project - no package.json found'));
}

function detectPackageManager(): Result<string, ZeroError> {
  if (existsSync('yarn.lock')) return ok('yarn');
  if (existsSync('pnpm-lock.yaml')) return ok('pnpm');
  if (existsSync('bun.lockb')) return ok('bun');
  if (existsSync('package-lock.json')) return ok('npm');
  
  // Default to npm
  return ok('npm');
}

// Check functions
function checkHusky(): boolean {
  return existsSync('.husky') && existsSync('package.json') && 
    readFileSync('package.json', 'utf8').includes('"husky"');
}

function checkVanillaHooks(): boolean {
  return existsSync('.githooks/pre-commit') || existsSync('.git/hooks/pre-commit');
}

async function checkEslint(): Promise<Result<boolean, ZeroError>> {
  const localCheck = await execCmd('npx eslint --version');
  const globalCheck = await execCmd('eslint --version');
  
  return ok(localCheck.ok || globalCheck.ok);
}

// Setup functions
async function setupHuskyHooks(pkgManager: string): Promise<Result<void, ZeroError>> {
  console.log(chalk.blue('🐕 Setting up Husky hooks...'));
  
  // Check if .husky/pre-commit exists
  if (existsSync('.husky/pre-commit')) {
    console.log(chalk.yellow('⚠️  Found existing .husky/pre-commit hook'));
    console.log(chalk.gray('Current content:'));
    console.log('---');
    console.log(readFileSync('.husky/pre-commit', 'utf8'));
    console.log('---\n');
    
    const { shouldAppend } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldAppend',
      message: '🐕 Husky setup detected. Want to replace it with our zero-throw hook?',
      default: true,
    }]);
    
    if (!shouldAppend) {
      console.log(chalk.yellow('Skipping husky modification'));
      return ok(undefined);
    }
  }
  
  // Write our TypeScript pre-commit hook
  try {
    writeFileSync('.husky/pre-commit', '#!/usr/bin/env bash\nnpx tsx scripts/githooks/zerohook.ts\n');
    chmodSync('.husky/pre-commit', 0o755);
    console.log(chalk.green('✅ Created .husky/pre-commit hook'));
  } catch (error: any) {
    return err(new ZeroError('HOOK_CREATE_FAILED', 'Failed to create pre-commit hook', { cause: error }));
  }
  
  return ok(undefined);
}

async function setupVanillaHooks(): Promise<Result<void, ZeroError>> {
  console.log(chalk.blue('🔧 Setting up vanilla git hooks...'));
  
  // Create .githooks directory
  if (!existsSync('.githooks')) {
    mkdirSync('.githooks');
  }
  
  const hookFile = '.githooks/pre-commit';
  if (existsSync(hookFile)) {
    console.log(chalk.yellow('⚠️  Found existing pre-commit hook'));
    const content = readFileSync(hookFile, 'utf8');
    console.log(chalk.gray('Current content:'));
    console.log('---');
    console.log(content.substring(0, 500));
    if (content.length > 500) console.log('... (truncated)');
    console.log('---\n');
    
    if (content.includes('ZeroThrow') || content.includes('zerohook')) {
      console.log(chalk.green('✅ ZeroThrow hook is already installed'));
      return ok(undefined);
    }
    
    const { shouldReplace } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldReplace',
      message: 'Replace existing hook with zero-throw TypeScript version?',
      default: true,
    }]);
    
    if (!shouldReplace) {
      console.log(chalk.yellow('Skipping hook modification'));
      return ok(undefined);
    }
  }
  
  // Write TypeScript hook
  try {
    writeFileSync(hookFile, '#!/usr/bin/env bash\nnpx tsx scripts/zerohook.ts\n');
    chmodSync(hookFile, 0o755);
    console.log(chalk.green('✅ Created .githooks/pre-commit hook'));
    
    // Configure git to use .githooks
    const gitConfigResult = execCmd('git config core.hooksPath .githooks');
    if (!result.ok(gitConfigResult)) {
      return gitConfigResult;
    }
    console.log(chalk.green('✅ Configured Git to use .githooks directory'));
  } catch (error: any) {
    return err(new ZeroError('GIT_HOOK_FAILED', 'Failed to create git hook', { cause: error }));
  }
  
  return ok(undefined);
}

async function ensureEslint(pkgManager: string): Promise<Result<void, ZeroError>> {
  const eslintCheck = checkEslint();
  if (!result.ok(eslintCheck)) return eslintCheck;
  
  if (!eslintCheck.value) {
    console.log(chalk.yellow('⚠️  ESLint not found'));
    const { shouldInstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Would you like to install ESLint?',
      default: true,
    }]);
    
    if (!shouldInstall) {
      return err(new ZeroError('ESLINT_REQUIRED', 'ESLint required - please install ESLint manually'));
    }
    
    const installCmd = pkgManager === 'npm' 
      ? 'npm install --save-dev eslint'
      : `${pkgManager} add -D eslint`;
      
    const installResult = execCmd(installCmd);
    if (!result.ok(installResult)) return installResult;
    
    console.log(chalk.green('✅ Installed ESLint'));
    
    // Check for TypeScript project
    if (existsSync('tsconfig.json')) {
      const { shouldInstallTS } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldInstallTS',
        message: 'TypeScript project detected. Install @typescript-eslint plugins?',
        default: true,
      }]);
      
      if (shouldInstallTS) {
        const tsPkgs = '@typescript-eslint/parser @typescript-eslint/eslint-plugin';
        const tsInstallCmd = pkgManager === 'npm'
          ? `npm install --save-dev ${tsPkgs}`
          : `${pkgManager} add -D ${tsPkgs}`;
          
        const tsResult = execCmd(tsInstallCmd);
        if (!result.ok(tsResult)) return tsResult;
        
        console.log(chalk.green('✅ Installed TypeScript ESLint plugins'));
      }
    }
  }
  
  return ok(undefined);
}

async function ensureLintScript(): Promise<Result<void, ZeroError>> {
  const pkgResult = readJsonFile<any>('package.json');
  if (!result.ok(pkgResult)) return pkgResult;
  
  const pkg = pkgResult.value;
  if (!pkg.scripts?.lint) {
    console.log(chalk.yellow('⚠️  No lint script found in package.json'));
    const { shouldAdd } = await inquirer.prompt([{
      type: 'confirm', 
      name: 'shouldAdd',
      message: 'Would you like me to add a basic ESLint script?',
      default: true,
    }]);
    
    if (!shouldAdd) {
      return err(new ZeroError('LINT_SCRIPT_REQUIRED', 'Lint script required - please add a lint script manually'));
    }
    
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.lint = existsSync('tsconfig.json')
      ? 'eslint "src/**/*.{ts,tsx}"'
      : 'eslint "src/**/*.{js,jsx}"';
      
    const writeResult = writeJsonFile('package.json', pkg);
    if (!result.ok(writeResult)) return writeResult;
    
    console.log(chalk.green('✅ Added lint script to package.json'));
  }
  
  return ok(undefined);
}

// Main function
async function main(): Promise<number> {
  console.log(chalk.blue('\n🚀 ZeroThrow Git Hooks Setup\n'));
  
  // Find project root
  const rootResult = findProjectRoot();
  if (!result.ok(rootResult)) {
    console.error(chalk.red(rootResult.error.message));
    return 1;
  }
  
  process.chdir(rootResult.value);
  console.log(chalk.green(`✅ Working in project root: ${rootResult.value}`));
  
  // Detect package manager
  const pkgMgrResult = detectPackageManager();
  if (!result.ok(pkgMgrResult)) {
    console.error(chalk.red(pkgMgrResult.error.message));
    return 1;
  }
  
  const pkgManager = pkgMgrResult.value;
  console.log(chalk.green(`✅ Using package manager: ${pkgManager}\n`));
  
  // Ensure dependencies
  const eslintResult = await ensureEslint(pkgManager);
  if (!result.ok(eslintResult)) {
    console.error(chalk.red(eslintResult.error.message));
    return 1;
  }
  
  const lintResult = await ensureLintScript();
  if (!result.ok(lintResult)) {
    console.error(chalk.red(lintResult.error.message));
    return 1;
  }
  
  // Install tsx if needed for TypeScript execution
  if (!existsSync('node_modules/tsx')) {
    console.log(chalk.yellow('⚠️  tsx not found (needed to run TypeScript hooks)'));
    const { shouldInstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldInstall', 
      message: 'Install tsx for TypeScript execution?',
      default: true,
    }]);
    
    if (shouldInstall) {
      const installCmd = pkgManager === 'npm'
        ? 'npm install --save-dev tsx'
        : `${pkgManager} add -D tsx`;
        
      const result = execCmd(installCmd);
      if (!result.ok(result)) {
        console.error(chalk.red('Failed to install tsx'));
        return 1;
      }
      console.log(chalk.green('✅ Installed tsx'));
    }
  }
  
  // Setup hooks based on existing configuration
  if (checkHusky()) {
    console.log(chalk.green('✅ Detected Husky setup'));
    const huskyResult = await setupHuskyHooks(pkgManager);
    if (!result.ok(huskyResult)) {
      console.error(chalk.red(huskyResult.error.message));
      return 1;
    }
  } else if (checkVanillaHooks()) {
    console.log(chalk.green('✅ Detected existing git hooks'));
    const vanillaResult = await setupVanillaHooks();
    if (!result.ok(vanillaResult)) {
      console.error(chalk.red(vanillaResult.error.message));
      return 1;
    }
  } else {
    // No existing hooks
    console.log('No existing git hooks detected.\n');
    const { hookType } = await inquirer.prompt([{
      type: 'list',
      name: 'hookType',
      message: 'Which setup would you prefer?',
      choices: [
        { name: 'Husky (recommended for teams)', value: 'husky' },
        { name: 'Vanilla git hooks (no dependencies)', value: 'vanilla' },
      ],
    }]);
    
    if (hookType === 'husky') {
      // Install husky if needed
      if (!existsSync('node_modules/husky')) {
        const installCmd = pkgManager === 'npm'
          ? 'npm install --save-dev husky'
          : `${pkgManager} add -D husky`;
          
        console.log(chalk.blue('Installing husky...'));
        const installResult = execCmd(installCmd);
        if (!result.ok(installResult)) {
          console.error(chalk.red('Failed to install husky'));
          return 1;
        }
        
        // Initialize husky
        const initResult = execCmd('npx husky init');
        if (!result.ok(initResult)) {
          console.error(chalk.red('Failed to initialize husky'));
          return 1;
        }
        
        console.log(chalk.green('✅ Installed and initialized husky'));
      }
      
      const huskyResult = await setupHuskyHooks(pkgManager);
      if (!result.ok(huskyResult)) {
        console.error(chalk.red(huskyResult.error.message));
        return 1;
      }
    } else {
      const vanillaResult = await setupVanillaHooks();
      if (!result.ok(vanillaResult)) {
        console.error(chalk.red(vanillaResult.error.message));
        return 1;
      }
    }
  }
  
  console.log(chalk.green('\n✨ ZeroThrow setup complete!\n'));
  console.log('Your commits will now be checked using the zero-throw TypeScript hook.');
  console.log('The hook will:');
  console.log('  • Run tests');
  console.log('  • Check for partially staged files');
  console.log('  • Provide interactive staging options');
  console.log('  • Run ESLint with no-throw rules');
  console.log('\nFor more info: https://github.com/flyingrobots/zerothrow');
  
  return 0;
}

// Run the setup
main().then(exitCode => process.exit(exitCode));