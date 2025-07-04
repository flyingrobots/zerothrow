#!/usr/bin/env tsx
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { ZT, ZeroThrow } from '../../packages/core/src/index';
import { execCmd, readJsonFile, writeJsonFile, fileExists, readFile, writeFile } from '../lib/shared';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Helper functions specific to setup-hooks

function findProjectRoot(): ZeroThrow.Result<string, ZeroThrow.ZeroError> {
  let currentDir = process.cwd();
  
  while (currentDir !== '/') {
    if (existsSync(path.join(currentDir, 'package.json'))) {
      return ZT.ok(currentDir);
    }
    currentDir = path.dirname(currentDir);
  }
  
  return ZT.err(new ZeroThrow.ZeroError('NOT_NODE_PROJECT', 'Not in a Node.js project - no package.json found'));
}

function detectPackageManager(): ZeroThrow.Result<string, ZeroThrow.ZeroError> {
  if (existsSync('yarn.lock')) return ZT.ok('yarn');
  if (existsSync('pnpm-lock.yaml')) return ZT.ok('pnpm');
  if (existsSync('bun.lockb')) return ZT.ok('bun');
  if (existsSync('package-lock.json')) return ZT.ok('npm');
  
  // Default to npm
  return ZT.ok('npm');
}

// Check functions
function checkHusky(): boolean {
  return existsSync('.husky') && existsSync('package.json') && 
    readFileSync('package.json', 'utf8').includes('"husky"');
}

function checkVanillaHooks(): boolean {
  return existsSync('.githooks/pre-commit') || existsSync('.git/hooks/pre-commit');
}

async function checkEslint(): Promise<ZeroThrow.Result<boolean, ZeroThrow.ZeroError>> {
  const localCheck = await execCmd('npx eslint --version');
  const globalCheck = await execCmd('eslint --version');
  
  return ZT.ok(localCheck.ok || globalCheck.ok);
}

// Setup functions
async function setupHuskyHooks(pkgManager: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
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
      return ZT.ok(undefined);
    }
  }
  
  // Write our TypeScript pre-commit hook
  try {
    writeFileSync('.husky/pre-commit', '#!/usr/bin/env bash\nnpx tsx scripts/githooks/zerohook.ts\n');
    chmodSync('.husky/pre-commit', 0o755);
    console.log(chalk.green('✅ Created .husky/pre-commit hook'));
  } catch (error: any) {
    return ZT.err(new ZeroThrow.ZeroError('HOOK_CREATE_FAILED', 'Failed to create pre-commit hook', { cause: error }));
  }
  
  return ZT.ok(undefined);
}

async function setupVanillaHooks(): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
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
      return ZT.ok(undefined);
    }
    
    const { shouldReplace } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldReplace',
      message: 'Replace existing hook with zero-throw TypeScript version?',
      default: true,
    }]);
    
    if (!shouldReplace) {
      console.log(chalk.yellow('Skipping hook modification'));
      return ZT.ok(undefined);
    }
  }
  
  // Write TypeScript hook
  try {
    writeFileSync(hookFile, '#!/usr/bin/env bash\nnpx tsx scripts/zerohook.ts\n');
    chmodSync(hookFile, 0o755);
    console.log(chalk.green('✅ Created .githooks/pre-commit hook'));
    
    // Configure git to use .githooks
    const gitConfigResult = await execCmd('git config core.hooksPath .githooks');
    if (!gitConfigResult.ok) {
      return ZT.err(gitConfigResult.error);
    }
    console.log(chalk.green('✅ Configured Git to use .githooks directory'));
  } catch (error: any) {
    return ZT.err(new ZeroThrow.ZeroError('GIT_HOOK_FAILED', 'Failed to create git hook', { cause: error }));
  }
  
  return ZT.ok(undefined);
}

async function ensureEslint(pkgManager: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const eslintCheck = await checkEslint();
  if (!eslintCheck.ok) return ZT.err(eslintCheck.error);
  
  if (!eslintCheck.value) {
    console.log(chalk.yellow('⚠️  ESLint not found'));
    const { shouldInstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Would you like to install ESLint?',
      default: true,
    }]);
    
    if (!shouldInstall) {
      return ZT.err(new ZeroThrow.ZeroError('ESLINT_REQUIRED', 'ESLint required - please install ESLint manually'));
    }
    
    const installCmd = pkgManager === 'npm' 
      ? 'npm install --save-dev eslint'
      : `${pkgManager} add -D eslint`;
      
    const installResult = await execCmd(installCmd);
    if (!installResult.ok) return ZT.err(installResult.error);
    
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
          
        const tsResult = await execCmd(tsInstallCmd);
        if (!tsResult.ok) return ZT.err(tsResult.error);
        
        console.log(chalk.green('✅ Installed TypeScript ESLint plugins'));
      }
    }
  }
  
  return ZT.ok(undefined);
}

async function ensureLintScript(): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const pkgResult = await readJsonFile<any>('package.json');
  if (!pkgResult.ok) return ZT.err(pkgResult.error);
  
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
      return ZT.err(new ZeroThrow.ZeroError('LINT_SCRIPT_REQUIRED', 'Lint script required - please add a lint script manually'));
    }
    
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.lint = existsSync('tsconfig.json')
      ? 'eslint "src/**/*.{ts,tsx}"'
      : 'eslint "src/**/*.{js,jsx}"';
      
    const writeResult = await writeJsonFile('package.json', pkg);
    if (!writeResult.ok) return ZT.err(writeResult.error);
    
    console.log(chalk.green('✅ Added lint script to package.json'));
  }
  
  return ZT.ok(undefined);
}

// Main function
async function main(): Promise<number> {
  console.log(chalk.blue('\n🚀 ZeroThrow Git Hooks Setup\n'));
  
  // Find project root
  const rootResult = findProjectRoot();
  if (!rootResult.ok) {
    const errorResult = rootResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
    console.error(chalk.red(errorResult.error.message));
    return 1;
  }
  
  process.chdir(rootResult.value);
  console.log(chalk.green(`✅ Working in project root: ${rootResult.value}`));
  
  // Detect package manager
  const pkgMgrResult = detectPackageManager();
  if (!pkgMgrResult.ok) {
    const errorResult = pkgMgrResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
    console.error(chalk.red(errorResult.error.message));
    return 1;
  }
  
  const pkgManager = pkgMgrResult.value;
  console.log(chalk.green(`✅ Using package manager: ${pkgManager}\n`));
  
  // Ensure dependencies
  const eslintResult = await ensureEslint(pkgManager);
  if (!eslintResult.ok) {
    const errorResult = eslintResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
    console.error(chalk.red(errorResult.error.message));
    return 1;
  }
  
  const lintResult = await ensureLintScript();
  if (!lintResult.ok) {
    const errorResult = lintResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
    console.error(chalk.red(errorResult.error.message));
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
        
      const result = await execCmd(installCmd);
      if (!result.ok) {
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
    if (!huskyResult.ok) {
      const errorResult = huskyResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
      console.error(chalk.red(errorResult.error.message));
      return 1;
    }
  } else if (checkVanillaHooks()) {
    console.log(chalk.green('✅ Detected existing git hooks'));
    const vanillaResult = await setupVanillaHooks();
    if (!vanillaResult.ok) {
      const errorResult = vanillaResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
      console.error(chalk.red(errorResult.error.message));
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
        const installResult = await execCmd(installCmd);
        if (!installResult.ok) {
          console.error(chalk.red('Failed to install husky'));
          return 1;
        }
        
        // Initialize husky
        const initResult = await execCmd('npx husky init');
        if (!initResult.ok) {
          console.error(chalk.red('Failed to initialize husky'));
          return 1;
        }
        
        console.log(chalk.green('✅ Installed and initialized husky'));
      }
      
      const huskyResult = await setupHuskyHooks(pkgManager);
      if (!huskyResult.ok) {
        const errorResult = huskyResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
        console.error(chalk.red(errorResult.error.message));
        return 1;
      }
    } else {
      const vanillaResult = await setupVanillaHooks();
      if (!vanillaResult.ok) {
        const errorResult = vanillaResult as ZeroThrow.Err<ZeroThrow.ZeroError>;
        console.error(chalk.red(errorResult.error.message));
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
  console.log('\nFor more info: https://github.com/zerothrow/zerothrow');
  
  return 0;
}

// Run the setup
main().then(exitCode => process.exit(exitCode));