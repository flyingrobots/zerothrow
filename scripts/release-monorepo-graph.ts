#!/usr/bin/env tsx

/**
 * GRAPH-POWERED Monorepo release script for ZeroThrow
 * Uses @zerothrow/graph for dynamic dependency analysis
 * Replaces hardcoded RELEASE_PHASES with intelligent graph traversal
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ZT } from '@zerothrow/core';
import { PackageDependencyGraph } from './PackageDependencyGraph.js';

interface PackageInfo {
  name: string;
  localVersion: string;
  npmVersion: string;
  needsPublish: boolean;
  phase: number;
  dependencies: string[];
}

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

async function analyzePackagesWithGraph(): Promise<{ packages: PackageInfo[], phases: string[][] }> {
  const spinner = ora('🔍 Scanning package dependencies with graph analysis...').start();
  
  const graph = new PackageDependencyGraph();
  
  try {
    // Scan all packages and build dependency graph
    graph.scanPackages();
    
    // Check for circular dependencies 
    const cycles = graph.detectCircularDependencies();
    if (cycles.length > 0) {
      spinner.fail('❌ Circular dependencies detected!');
      console.error(chalk.red('Circular dependencies found:'));
      for (const cycle of cycles) {
        console.error(chalk.red(`  ${cycle}`));
      }
      process.exit(1);
    }
    
    // Get optimal release order
    const phases = graph.getOptimalReleaseOrder();
    spinner.succeed(`✅ Dependency analysis complete - ${phases.length} phases identified`);
    
    // Build package info with version checking
    const versionSpinner = ora('🔍 Checking package versions...').start();
    const packages: PackageInfo[] = [];
    
    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
      for (const packageName of phases[phaseIndex]) {
        const localVersion = getPackageVersion(packageName, 'local');
        const npmVersion = getPackageVersion(packageName, 'npm');
        const needsPublish = localVersion !== npmVersion && npmVersion !== 'unpublished';
        
        // Update graph with version info
        graph.updatePackageVersions(packageName, localVersion, npmVersion);
        
        const packageNode = graph.getAllPackages().get(packageName)!;
        
        packages.push({
          name: packageName,
          localVersion,
          npmVersion,
          needsPublish,
          phase: phaseIndex + 1,
          dependencies: Array.from(packageNode.dependencies)
        });
      }
    }
    
    versionSpinner.succeed('✅ Version analysis complete');
    
    return { packages, phases };
  } catch (error) {
    spinner.fail('❌ Graph analysis failed');
    throw error;
  }
}

function displayAdvancedPackageTable(packages: PackageInfo[]) {
  console.log('\n📦 GRAPH-POWERED Package Release Plan:\n');
  console.log(chalk.gray('Phase | Package                   | Local  | NPM    | Dependencies | Action'));
  console.log(chalk.gray('------+---------------------------+--------+--------+--------------+----------'));
  
  for (const pkg of packages) {
    const action = pkg.needsPublish 
      ? chalk.green('✅ Publish') 
      : chalk.gray('✓ Current');
    
    const deps = pkg.dependencies.length > 0 
      ? pkg.dependencies.map(d => d.replace('@zerothrow/', '')).join(', ')
      : chalk.gray('none');
    
    console.log(
      `  ${pkg.phase}   | ${pkg.name.padEnd(25)} | ${pkg.localVersion.padEnd(6)} | ${pkg.npmVersion.padEnd(6)} | ${deps.padEnd(12)} | ${action}`
    );
  }
}

async function performDryRun(packages: PackageInfo[]): Promise<boolean> {
  console.log(chalk.blue('\n🧪 Running graph-guided dry-run publish...\n'));
  
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

async function publishPackagesWithGraph(packages: PackageInfo[], phases: string[][]) {
  console.log(chalk.blue('\n🚀 Publishing packages using graph-optimized order...\n'));
  
  const graph = new PackageDependencyGraph();
  graph.scanPackages();
  
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
    const phasePackages = phases[phaseIndex].filter(name => 
      packages.find(p => p.name === name)?.needsPublish
    );
    
    if (phasePackages.length === 0) continue;
    
    console.log(chalk.yellow(`\n📍 Phase ${phaseIndex + 1} (${phasePackages.length} packages in parallel):`));
    console.log(chalk.gray(`  Packages: ${phasePackages.map(p => p.replace('@zerothrow/', '')).join(', ')}`));
    
    // Start building all packages in this phase
    for (const packageName of phasePackages) {
      graph.startBuilding(packageName);
    }
    
    // Publish packages in parallel for this phase
    const publishPromises = phasePackages.map(async (packageName) => {
      const pkg = packages.find(p => p.name === packageName)!;
      const spinner = ora(`Publishing ${packageName}@${pkg.localVersion}`).start();
      
      const result = ZT.try(() => {
        const pkgShortName = packageName.replace('@zerothrow/', '');
        
        // Add a small delay to ensure npm registry updates
        if (phaseIndex > 0) {
          execSync('sleep 2');
        }
        
        execSync(`pnpm publish -w packages/${pkgShortName}`, { 
          stdio: 'pipe',
          encoding: 'utf-8' 
        });
      });
      
      if (result.ok) {
        graph.markReleased(packageName);
        spinner.succeed(`Published ${packageName}@${pkg.localVersion}`);
        return { success: true, packageName };
      } else {
        graph.markFailed(packageName);
        spinner.fail(`Failed to publish ${packageName}`);
        console.error(chalk.red(`  Error: ${result.error.message}`));
        return { success: false, packageName, error: result.error.message };
      }
    });
    
    // Wait for all packages in this phase to complete
    const results = await Promise.all(publishPromises);
    
    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.error(chalk.red('\n❌ Release halted due to failures in phase!'));
      for (const failure of failures) {
        console.error(chalk.red(`  Failed: ${failure.packageName}`));
      }
      console.error(chalk.yellow('Fix the issues and re-run to continue from this phase.'));
      process.exit(1);
    }
    
    // Wait for npm registry to update between phases
    if (phaseIndex < phases.length - 1 && phasePackages.length > 0) {
      const waitSpinner = ora('⏳ Waiting for npm registry to propagate...').start();
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitSpinner.succeed('✅ Registry propagation complete');
    }
  }
}

function generateGraphVisualization(packages: PackageInfo[]): void {
  console.log(chalk.blue('\n🕸️  Dependency Graph Visualization:'));
  console.log(chalk.gray('   (Use with graphviz: pbpaste | dot -Tpng > deps.png)\n'));
  
  const graph = new PackageDependencyGraph();
  graph.scanPackages();
  
  const dotFormat = graph.toDot();
  console.log(chalk.cyan(dotFormat));
}

async function main() {
  console.log(chalk.bold.blue('\n🚀 ZeroThrow GRAPH-POWERED Release Tool\n'));
  console.log(chalk.green('✨ Now using @zerothrow/graph for intelligent dependency analysis!'));
  
  // Check for npm authentication
  const authCheck = ZT.try(() => execSync('pnpm whoami', { encoding: 'utf-8' }));
  if (!authCheck.ok) {
    console.error(chalk.red('❌ Not logged in to npm registry!'));
    console.error(chalk.yellow('Run: pnpm login'));
    process.exit(1);
  }
  
  console.log(chalk.green(`✓ Logged in as: ${authCheck.value.trim()}`));
  
  // Analyze packages using graph
  const { packages, phases } = await analyzePackagesWithGraph();
  const packagesToPublish = packages.filter(p => p.needsPublish);
  
  displayAdvancedPackageTable(packages);
  
  console.log(chalk.blue(`\n🔗 Graph Analysis Results:`));
  console.log(chalk.blue(`   Phases: ${phases.length}`));
  console.log(chalk.blue(`   Total packages: ${packages.length}`));
  console.log(chalk.blue(`   Packages to publish: ${packagesToPublish.length}`));
  console.log(chalk.blue(`   Parallel opportunities: ${phases.map(p => p.length).join(' + ')} packages`));
  
  if (packagesToPublish.length === 0) {
    console.log(chalk.green('\n✨ All packages are up to date!'));
    
    // Still show the graph visualization
    generateGraphVisualization(packages);
    return;
  }
  
  console.log(chalk.yellow(`\n⚠️  ${packagesToPublish.length} packages need publishing`));
  
  // Show graph visualization
  generateGraphVisualization(packages);
  
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
    message: 'Ready to publish using graph-optimized release order?',
    default: false,
  }]);
  
  if (!proceed) {
    console.log(chalk.yellow('\n✋ Release cancelled'));
    return;
  }
  
  // Do the real publish
  await publishPackagesWithGraph(packagesToPublish, phases);
  
  console.log(chalk.green.bold('\n✅ Graph-powered release complete!'));
  console.log(chalk.green('🔗 Dependency order was calculated dynamically'));
  console.log(chalk.green('⚡ Parallel publishing opportunities were maximized'));
  console.log(chalk.blue('\nNext steps:'));
  console.log('1. Create a GitHub release');
  console.log('2. Update any example repositories');
  console.log('3. Tweet about the graph-powered release! 🚀');
}

// Run it!
main().catch(error => {
  console.error(chalk.red('\n💥 Unexpected error:'), error);
  process.exit(1);
});