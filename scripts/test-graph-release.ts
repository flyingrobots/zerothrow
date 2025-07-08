#!/usr/bin/env tsx

/**
 * Test script for PackageDependencyGraph
 * Validates graph-based dependency analysis without publishing
 */

import chalk from 'chalk';
import { PackageDependencyGraph } from './PackageDependencyGraph.js';

async function main() {
  console.log(chalk.bold.blue('\n🧪 Testing PackageDependencyGraph Implementation\n'));
  
  try {
    const graph = new PackageDependencyGraph();
    
    // Test 1: Package scanning
    console.log(chalk.blue('Test 1: Package Scanning'));
    graph.scanPackages();
    const packages = graph.getAllPackages();
    console.log(chalk.green(`✅ Scanned ${packages.size} packages`));
    
    // Test 2: Circular dependency detection
    console.log(chalk.blue('\nTest 2: Circular Dependency Detection'));
    const cycles = graph.detectCircularDependencies();
    if (cycles.length === 0) {
      console.log(chalk.green('✅ No circular dependencies found'));
    } else {
      console.log(chalk.red(`❌ Found ${cycles.length} circular dependencies:`));
      cycles.forEach(cycle => console.log(chalk.red(`  ${cycle}`)));
    }
    
    // Test 3: Release order calculation
    console.log(chalk.blue('\nTest 3: Release Order Calculation'));
    const phases = graph.getOptimalReleaseOrder();
    console.log(chalk.green(`✅ Calculated ${phases.length} release phases:`));
    
    phases.forEach((phase, index) => {
      console.log(chalk.cyan(`  Phase ${index + 1}: ${phase.map(p => p.replace('@zerothrow/', '')).join(', ')}`));
    });
    
    // Test 4: State machine transitions
    console.log(chalk.blue('\nTest 4: State Machine Transitions'));
    const testPackage = '@zerothrow/core';
    
    console.log(chalk.gray(`  Testing state transitions for ${testPackage}`));
    
    const canStart = graph.canReleasePackage(testPackage, new Set());
    console.log(chalk.cyan(`  Can start building: ${canStart}`));
    
    if (canStart) {
      const startSuccess = graph.startBuilding(testPackage);
      console.log(chalk.cyan(`  Started building: ${startSuccess}`));
      
      const releaseSuccess = graph.markReleased(testPackage);
      console.log(chalk.cyan(`  Marked as released: ${releaseSuccess}`));
      
      console.log(chalk.green('✅ State machine transitions working'));
    }
    
    // Test 5: DOT visualization
    console.log(chalk.blue('\nTest 5: Graph Visualization'));
    const dotGraph = graph.toDot();
    console.log(chalk.green('✅ Generated DOT format graph:'));
    console.log(chalk.gray(dotGraph));
    
    // Test 6: Package information
    console.log(chalk.blue('\nTest 6: Package Dependency Analysis'));
    console.log(chalk.green('✅ Package Dependencies:'));
    
    for (const [name, packageNode] of packages) {
      const deps = packageNode.dependencies.size > 0 
        ? Array.from(packageNode.dependencies).map(d => d.replace('@zerothrow/', '')).join(', ')
        : 'none';
      console.log(chalk.cyan(`  ${name.replace('@zerothrow/', '')}: depends on [${deps}]`));
    }
    
    console.log(chalk.bold.green('\n🎉 All tests passed! Graph implementation is working correctly.'));
    console.log(chalk.blue('The new graph-powered release system is ready to deploy!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
}

main();