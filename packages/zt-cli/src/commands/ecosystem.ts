// SPDX-License-Identifier: MIT
// Copyright (c) 2025 J. Kirby Ross

import { ZT, ZeroThrow } from '@zerothrow/core';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  path: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export async function ecosystemCommand(subcommand: string): Promise<ZeroThrow.Result<void, Error>> {
  if (subcommand === 'check') {
    return checkEcosystem();
  }
  
  if (subcommand !== 'sync') {
    return ZT.err(new ZeroThrow.ZeroError('INVALID_SUBCOMMAND', `Unknown subcommand: ${subcommand}`));
  }

  return syncEcosystem();
}

async function syncEcosystem(): Promise<ZeroThrow.Result<void, Error>> {
  const spinner = ora('Syncing ECOSYSTEM.md...').start();

  try {
    // Find repo root
    let rootDir = process.cwd();
    while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
      rootDir = join(rootDir, '..');
    }

    // Read all packages
    const packages = await getAllPackages(rootDir);
    
    // Generate new ECOSYSTEM.md content
    const content = generateEcosystemContent(packages);
    
    // Write to ECOSYSTEM.md
    const ecosystemPath = join(rootDir, 'ECOSYSTEM.md');
    await writeFile(ecosystemPath, content);
    
    spinner.succeed('ECOSYSTEM.md synced successfully!');
    
    console.log(chalk.green(`\n✅ Updated with ${packages.length} packages`));
    
    return ZT.ok(undefined);
  } catch (error) {
    spinner.fail('Failed to sync ECOSYSTEM.md');
    return ZT.err(new Error(`Failed to sync: ${error}`));
  }
}

async function checkEcosystem(): Promise<ZeroThrow.Result<void, Error>> {
  const spinner = ora('Checking ECOSYSTEM.md...').start();

  try {
    let rootDir = process.cwd();
    while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
      rootDir = join(rootDir, '..');
    }

    const packages = await getAllPackages(rootDir);
    const expectedContent = generateEcosystemContent(packages);
    
    const ecosystemPath = join(rootDir, 'ECOSYSTEM.md');
    const actualContent = await readFile(ecosystemPath, 'utf-8');
    
    // Compare normalized content (ignore whitespace differences)
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    
    if (normalize(actualContent) !== normalize(expectedContent)) {
      spinner.fail('ECOSYSTEM.md is out of sync!');
      console.log(chalk.red('\n❌ ECOSYSTEM.md needs to be updated'));
      console.log(chalk.yellow('\n💡 Run "zt ecosystem sync" to fix\n'));
      process.exit(1);
    }
    
    spinner.succeed('ECOSYSTEM.md is up to date!');
    return ZT.ok(undefined);
  } catch (error) {
    spinner.fail('Failed to check ECOSYSTEM.md');
    return ZT.err(new Error(`Failed to check: ${error}`));
  }
}

async function getAllPackages(rootDir: string): Promise<PackageInfo[]> {
  const packagesDir = join(rootDir, 'packages');
  const dirs = await readdir(packagesDir);
  const packages: PackageInfo[] = [];

  for (const dir of dirs) {
    const packageJsonPath = join(packagesDir, dir, 'package.json');
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      packages.push({
        name: pkg.name || dir,
        version: pkg.version || '0.0.0',
        description: pkg.description || '',
        path: dir,
        dependencies: pkg.dependencies,
        peerDependencies: pkg.peerDependencies,
      });
    } catch {
      // Skip if no package.json
    }
  }

  // Sort by name
  packages.sort((a, b) => a.name.localeCompare(b.name));
  
  return packages;
}

function generateEcosystemContent(packages: PackageInfo[]): string {
  const header = `# ZeroThrow Ecosystem

The ZeroThrow monorepo contains multiple packages that work together to provide a complete error handling solution for TypeScript.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
`;

  const packageRows = packages.map(pkg => 
    `| [${pkg.name}](./packages/${pkg.path}) | ${pkg.version} | ${pkg.description} |`
  ).join('\n');

  const peerDepsSection = `

## Peer Dependencies

This chart shows which packages depend on which other packages:

| Package | Peer Dependencies |
|---------|-------------------|
`;

  const peerDepsRows = packages.map(pkg => {
    const peers = pkg.peerDependencies ? Object.keys(pkg.peerDependencies).join(', ') : 'none';
    return `| ${pkg.name} | ${peers} |`;
  }).join('\n');

  const footer = `

## Installation

### Core Package
\`\`\`bash
npm install @zerothrow/core
\`\`\`

### With Testing Support
\`\`\`bash
npm install @zerothrow/core @zerothrow/jest
# or
npm install @zerothrow/core @zerothrow/vitest
\`\`\`

### With Resilience Patterns
\`\`\`bash
npm install @zerothrow/core @zerothrow/resilience
\`\`\`

## Development

All packages follow the same development workflow:

\`\`\`bash
# Build all packages
npm run build

# Run tests
npm run test

# Check types
npm run type-check

# Lint
npm run lint
\`\`\`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © J. Kirby Ross
`;

  return header + packageRows + peerDepsSection + peerDepsRows + footer;
}