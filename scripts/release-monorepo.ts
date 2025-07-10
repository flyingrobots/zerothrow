#!/usr/bin/env tsx

/**
 * Monorepo release script for ZeroThrow
 * Handles dependency order and breaking changes
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ZT, ZeroThrow } from '@zerothrow/core';

interface PackageInfo {
  name: string;
  localVersion: string;
  npmVersion: string;
  needsPublish: boolean;
  phase: number;
}

// Release order is CRITICAL due to peer dependencies
const RELEASE_PHASES = [
  // Phase 1: Core (has breaking changes)
  ['@zerothrow/core'],
  
  // Phase 2: Direct core dependencies + expect (needed by test packages)
  ['@zerothrow/expect', '@zerothrow/resilience', '@zerothrow/docker', '@zerothrow/zt-cli'],
  
  // Phase 3: Test packages (depend on core + expect)
  ['@zerothrow/jest', '@zerothrow/vitest', '@zerothrow/testing'],
];

function getPackageVersion(packageName: string, location: 'local' | 'npm'): string {
  try {
    if (location === 'local') {
      const output = execSync(`pnpm list ${packageName} --depth=0 --json`, { encoding: 'utf-8' });
      const data = JSON.parse(output);
      return data.dependencies?.[packageName]?.version || 'unknown';
    } else {
      const output = execSync(`pnpm view ${packageName} version 2>/dev/null`, { encoding: 'utf-8' });
      return output.trim();
    }
  } catch {
    return location === 'npm' ? 'unpublished' : 'error';
  }
}

async function analyzePackages(): Promise<PackageInfo[]> {
  const spinner = ora('Analyzing package versions...').start();
  const packages: PackageInfo[] = [];
  
  for (let phase = 0; phase < RELEASE_PHASES.length; phase++) {
    for (const pkgName of RELEASE_PHASES[phase]) {
      
      const localVersion = getPackageVersion(pkgName, 'local');
      const npmVersion = getPackageVersion(pkgName, 'npm');
      const needsPublish = localVersion !== npmVersion && npmVersion !== 'unpublished';
      
      packages.push({
        name: pkgName,
        localVersion,
        npmVersion,
        needsPublish,
        phase: phase + 1,
      });
    }
  }
  
  spinner.succeed('Package analysis complete');
  return packages;
}

function displayPackageTable(packages: PackageInfo[]) {
  console.log('\n📦 Package Release Status:\n');
  console.log(chalk.gray('Phase | Package                   | Local  | NPM    | Action'));
  console.log(chalk.gray('------+---------------------------+--------+--------+----------'));
  
  for (const pkg of packages) {
    const action = pkg.needsPublish 
      ? chalk.green('✅ Publish') 
      : chalk.gray('✓ Current');
    
    console.log(
      `  ${pkg.phase}   | ${pkg.name.padEnd(25)} | ${pkg.localVersion.padEnd(6)} | ${pkg.npmVersion.padEnd(6)} | ${action}`
    );
  }
}

async function performDryRun(packages: PackageInfo[]): Promise<boolean> {
  console.log(chalk.blue('\n🧪 Running dry-run publish for all packages...\n'));
  
  for (const pkg of packages) {
    if (!pkg.needsPublish) continue;
    
    const spinner = ora(`Dry-run: ${pkg.name}`).start();
    
    const result = ZT.try(() => {
      const pkgShortName = pkg.name.replace('@zerothrow/', '');
      execSync(`pnpm publish --dry-run -w packages/${pkgShortName}`, { 
        stdio: 'pipe',
        encoding: 'utf-8' 
      });
    });
    
    if (result.ok) {
      spinner.succeed(`Dry-run: ${pkg.name} - Ready to publish`);
    } else {
      spinner.fail(`Dry-run: ${pkg.name} - FAILED`);
      console.error(chalk.red(`  Error: ${result.error.message}`));
      return false;
    }
  }
  
  return true;
}

async function publishPackages(packages: PackageInfo[]) {
  console.log(chalk.blue('\n🚀 Publishing packages in dependency order...\n'));
  
  for (let phase = 1; phase <= 3; phase++) {
    const phasePackages = packages.filter(p => p.phase === phase && p.needsPublish);
    
    if (phasePackages.length === 0) continue;
    
    console.log(chalk.yellow(`\n📍 Phase ${phase}:`));
    
    for (const pkg of phasePackages) {
      const spinner = ora(`Publishing ${pkg.name}@${pkg.localVersion}`).start();
      
      const result = ZT.try(() => {
        const pkgShortName = pkg.name.replace('@zerothrow/', '');
        
        // Add a small delay to ensure npm registry updates
        if (phase > 1) {
          execSync('sleep 2');
        }
        
        execSync(`pnpm publish -w packages/${pkgShortName}`, { 
          stdio: 'pipe',
          encoding: 'utf-8' 
        });
      });
      
      if (result.ok) {
        spinner.succeed(`Published ${pkg.name}@${pkg.localVersion}`);
      } else {
        spinner.fail(`Failed to publish ${pkg.name}`);
        console.error(chalk.red(`  Error: ${result.error.message}`));
        
        // Critical: Stop on any failure
        console.error(chalk.red('\n❌ Release halted due to error!'));
        console.error(chalk.yellow('Fix the issue and re-run to continue from this package.'));
        process.exit(1);
      }
    }
    
    // Wait for npm registry to update between phases
    if (phase < 3 && phasePackages.length > 0) {
      const waitSpinner = ora('Waiting for npm registry to update...').start();
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitSpinner.succeed('Registry should be updated');
    }
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🚀 ZeroThrow Monorepo Release Tool\n'));
  
  // Check for npm authentication
  const authCheck = ZT.try(() => execSync('pnpm whoami', { encoding: 'utf-8' }));
  if (!authCheck.ok) {
    console.error(chalk.red('❌ Not logged in to npm registry!'));
    console.error(chalk.yellow('Run: pnpm login'));
    process.exit(1);
  }
  
  console.log(chalk.green(`✓ Logged in as: ${authCheck.value.trim()}`));
  
  // Analyze packages
  const packages = await analyzePackages();
  const packagesToPublish = packages.filter(p => p.needsPublish);
  
  displayPackageTable(packages);
  
  if (packagesToPublish.length === 0) {
    console.log(chalk.green('\n✨ All packages are up to date!'));
    return;
  }
  
  console.log(chalk.yellow(`\n⚠️  ${packagesToPublish.length} packages need publishing`));
  console.log(chalk.red('⚠️  @zerothrow/core has BREAKING CHANGES (0.1.0 → 0.2.0)'));
  
  // Dry run first
  const dryRunSuccess = await performDryRun(packagesToPublish);
  if (!dryRunSuccess) {
    console.error(chalk.red('\n❌ Dry run failed! Fix issues before proceeding.'));
    process.exit(1);
  }
  
  // Confirm before real publish
  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: 'Ready to publish to npm?',
    default: false,
  }]);
  
  if (!proceed) {
    console.log(chalk.yellow('\n✋ Release cancelled'));
    return;
  }
  
  // Do the real publish
  await publishPackages(packagesToPublish);
  
  console.log(chalk.green.bold('\n✅ Release complete!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log('1. Create a GitHub release for v0.2.0');
  console.log('2. Update any example repositories');
  console.log('3. Tweet about the breaking changes');
}

// Run it!
main().catch(error => {
  console.error(chalk.red('\n💥 Unexpected error:'), error);
  process.exit(1);
});