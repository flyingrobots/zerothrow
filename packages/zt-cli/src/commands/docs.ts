// SPDX-License-Identifier: MIT
// Copyright (c) 2025 J. Kirby Ross

import { ZT, ZeroThrow } from '@zerothrow/core';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface PackageConfig {
  packageName: string;
  mascotImage: string;
  description: string;
}

// Package configurations
const packages: Record<string, PackageConfig> = {
  jest: {
    packageName: '@zerothrow/jest',
    mascotImage: 'zerothrow-jest.webp',
    description: 'Jest matchers for ZeroThrow Result types'
  },
  vitest: {
    packageName: '@zerothrow/vitest', 
    mascotImage: 'zerothrow-vitest.webp',
    description: 'Vitest matchers for ZeroThrow Result types'
  },
  resilience: {
    packageName: '@zerothrow/resilience',
    mascotImage: 'zerothrow-resilience.webp', 
    description: 'Production-grade resilience patterns for ZeroThrow'
  },
  core: {
    packageName: '@zerothrow/core',
    mascotImage: 'zerothrow-core.webp',
    description: 'Core ZeroThrow functionality - Rust-style Result<T, E> for TypeScript'
  },
  expect: {
    packageName: '@zerothrow/expect',
    mascotImage: 'zerothrow-expect.webp',
    description: 'Shared test matcher logic for ZeroThrow'
  },
  testing: {
    packageName: '@zerothrow/testing',
    mascotImage: 'zerothrow-testing.webp',
    description: 'Unified testing utilities for ZeroThrow'
  },
  docker: {
    packageName: '@zerothrow/docker',
    mascotImage: 'zerothrow-docker.webp',
    description: 'Docker integration for ZeroThrow'
  },
  'eslint-plugin': {
    packageName: '@zerothrow/eslint-plugin',
    mascotImage: 'zerothrow-eslint.webp',
    description: 'ESLint rules for ZeroThrow best practices'
  },
  'logger-winston': {
    packageName: '@zerothrow/logger-winston',
    mascotImage: 'zerothrow-winston.webp',
    description: 'Winston logger integration for ZeroThrow'
  },
  'logger-pino': {
    packageName: '@zerothrow/logger-pino',
    mascotImage: 'zerothrow-pino.webp',
    description: 'Pino logger integration for ZeroThrow'
  },
  react: {
    packageName: '@zerothrow/react',
    mascotImage: 'zerothrow-react.webp',
    description: 'React hooks and utilities for ZeroThrow'
  }
};

export async function docsCommand(subcommand: string, packageName?: string): Promise<ZeroThrow.Result<void, Error>> {
  if (subcommand === 'generate') {
    return generateDocs(packageName);
  } else if (subcommand === 'list') {
    return listDocs();
  }
  
  return ZT.err(new ZeroThrow.ZeroError('INVALID_SUBCOMMAND', `Unknown subcommand: ${subcommand}`));
}

function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'core', 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function buildPackageDocs(pkgShortName: string, config: PackageConfig, rootDir: string): ZeroThrow.Result<void, Error> {
  const sourcePath = path.join(rootDir, 'docs-src', 'packages', pkgShortName, 'README.md');
  const outputPath = path.join(rootDir, 'packages', pkgShortName, 'README.md');
  
  // Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    return ZT.err(new Error(`SOURCE_NOT_FOUND: No source file for ${pkgShortName}`));
  }

  console.log(`📝 Building ${chalk.cyan(pkgShortName)}...`);

  // Build the command with template variables as JSON
  const templateVarsJson = JSON.stringify(config);
  const basePath = path.join(rootDir, 'docs-src'); // Allow access to entire docs-src

  const command = `npx markdown-transclusion "${sourcePath}" --base-path "${basePath}" --template-variables '${templateVarsJson}' --output "${outputPath}"`;
  
  return ZT.try(() => {
    execSync(command, { stdio: 'pipe' });
    console.log(`✅ Generated ${chalk.green(outputPath)}`);
  }).mapErr(error => {
    if (error instanceof Error) {
      return new Error(`Failed to build ${pkgShortName}: ${error.message}`);
    }
    return new Error(`Failed to build ${pkgShortName}: Unknown error`);
  });
}

async function generateDocs(packageFilter?: string): Promise<ZeroThrow.Result<void, Error>> {
  const spinner = ora('Finding project root...').start();
  
  const rootDir = findProjectRoot(process.cwd());
  if (!rootDir) {
    spinner.fail('Could not find project root');
    return ZT.err(new Error('Could not find project root (no packages/core/package.json found)'));
  }
  
  spinner.text = 'Building documentation from source...';
  spinner.color = 'blue';

  // Filter packages if requested
  let packagesToBuild: Record<string, PackageConfig>;
  
  if (packageFilter) {
    if (!packages[packageFilter]) {
      spinner.fail(`Unknown package: ${packageFilter}`);
      return ZT.err(new Error(`Unknown package: ${packageFilter}`));
    }
    packagesToBuild = { [packageFilter]: packages[packageFilter] };
  } else {
    packagesToBuild = packages;
  }

  const results = Object.entries(packagesToBuild).map(([pkgShortName, config]) => {
    const result = buildPackageDocs(pkgShortName, config, rootDir);
    
    // Handle missing source files as non-errors
    if (!result.ok && result.error.message.includes('SOURCE_NOT_FOUND')) {
      console.log(chalk.yellow(`⏭️  Skipping ${pkgShortName} (no source file)`));
      return ZT.ok<void>(undefined); // Convert to success for missing files
    }
    
    return result.tapErr(err => console.error(chalk.red(`❌ ${err.message}`)));
  });

  const collected = ZeroThrow.collect(results);
  
  return collected
    .map(() => {
      spinner.succeed('Documentation build complete!');
      return undefined;
    })
    .mapErr(err => {
      spinner.fail('Documentation build failed!');
      return err;
    })
    .void();
}

async function listDocs(): Promise<ZeroThrow.Result<void, Error>> {
  const rootDir = findProjectRoot(process.cwd());
  if (!rootDir) {
    return ZT.err(new Error('Could not find project root'));
  }

  console.log(chalk.blue.bold('\n📚 Available documentation templates:\n'));
  
  Object.entries(packages).forEach(([name, config]) => {
    const sourcePath = path.join(rootDir, 'docs-src', 'packages', name, 'README.md');
    const exists = fs.existsSync(sourcePath);
    const status = exists ? chalk.green('✓') : chalk.gray('○');
    console.log(`${status} ${chalk.cyan(name)} - ${config.description}`);
  });

  console.log(chalk.gray('\n✓ = template exists, ○ = no template yet'));
  return ZT.ok(undefined);
}

