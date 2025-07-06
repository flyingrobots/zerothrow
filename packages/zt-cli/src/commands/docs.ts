// SPDX-License-Identifier: MIT
// Copyright (c) 2025 J. Kirby Ross

import { ZT, ZeroThrow } from '@zerothrow/core';
import { readFile, writeFile, readdir, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import chalk from 'chalk';
import ora from 'ora';
import { createTransclusionStream } from 'markdown-transclusion';

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  path: string;
}

export async function docsCommand(subcommand: string): Promise<ZeroThrow.Result<void, Error>> {
  if (subcommand === 'generate') {
    return generateDocs();
  }
  
  return ZT.err(new ZeroThrow.ZeroError('INVALID_SUBCOMMAND', `Unknown subcommand: ${subcommand}`));
}

async function generateDocs(): Promise<ZeroThrow.Result<void, Error>> {
  const spinner = ora('Generating documentation...').start();

  try {
    // Find repo root
    let rootDir = process.cwd();
    while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
      rootDir = join(rootDir, '..');
    }

    // Step 1: Generate package info files
    spinner.text = 'Extracting package information...';
    await generatePackageInfo(rootDir);

    // Step 2: Process ECOSYSTEM.md
    spinner.text = 'Processing ECOSYSTEM.md...';
    const ecosystemTemplate = join(rootDir, 'templates', 'ECOSYSTEM-template.md');
    const ecosystemOutput = join(rootDir, 'ECOSYSTEM.md');
    
    await processMarkdownFile(ecosystemTemplate, ecosystemOutput, rootDir);

    // Step 3: Process all package READMEs
    spinner.text = 'Processing package READMEs...';
    const packages = await getAllPackages(rootDir);
    
    for (const pkg of packages) {
      const packageShortName = pkg.name.replace('@zerothrow/', '');
      const readmeTemplate = join(rootDir, 'templates', 'README-template.md');
      const readmeOutput = join(rootDir, 'packages', pkg.path, 'README.md');
      
      // Check if package has custom README template
      const customTemplate = join(rootDir, 'templates', 'packages', `${packageShortName}-README.md`);
      const templateToUse = await fileExists(customTemplate) ? customTemplate : readmeTemplate;
      
      const variables = {
        PACKAGE_NAME: pkg.name,
        PACKAGE_SHORT_NAME: packageShortName,
        PACKAGE_VERSION: pkg.version,
        PACKAGE_DESCRIPTION: pkg.description
      };
      
      await processMarkdownFile(templateToUse, readmeOutput, rootDir, variables);
    }

    spinner.succeed('Documentation generated successfully!');
    
    console.log(chalk.green(`\n✅ Generated documentation for ${packages.length} packages`));
    console.log(chalk.blue('\n📝 Files updated:'));
    console.log(chalk.gray('  - ECOSYSTEM.md'));
    packages.forEach(pkg => {
      console.log(chalk.gray(`  - packages/${pkg.path}/README.md`));
    });
    
    return ZT.ok(undefined);
  } catch (error) {
    spinner.fail('Failed to generate documentation');
    return ZT.err(new Error(`Failed to generate docs: ${error}`));
  }
}

async function generatePackageInfo(rootDir: string): Promise<void> {
  const packagesDir = join(rootDir, 'packages');
  const templatesDir = join(rootDir, 'templates', 'packages');
  
  // Ensure templates directory exists
  await mkdir(templatesDir, { recursive: true });
  
  const packages = await readdir(packagesDir);
  
  for (const pkgDir of packages) {
    try {
      const packageJsonPath = join(packagesDir, pkgDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      // Generate version file
      const versionPath = join(templatesDir, `${pkgDir}-version.md`);
      await writeFile(versionPath, packageJson.version);
      
      // Generate description file
      const descPath = join(templatesDir, `${pkgDir}-description.md`);
      await writeFile(descPath, packageJson.description || 'Zero-throw utilities for TypeScript');
      
      // Generate full info table row
      const infoPath = join(templatesDir, `${pkgDir}-info.md`);
      const info = `| [\`${packageJson.name}\`](packages/${pkgDir}) | [![npm](https://img.shields.io/npm/v/${packageJson.name}.svg?style=flat-square)](https://npm.im/${packageJson.name}) | ${packageJson.description || 'Zero-throw utilities'} |`;
      await writeFile(infoPath, info);
      
    } catch (error) {
      // Skip if no package.json
    }
  }
}

async function processMarkdownFile(
  inputPath: string, 
  outputPath: string, 
  rootDir: string,
  variables?: Record<string, string>
): Promise<void> {
  // Process transclusions with variables
  const input = createReadStream(inputPath);
  const output = createWriteStream(outputPath);
  
  const transclusionStream = createTransclusionStream({
    basePath: rootDir,
    variables: variables || {},
    strict: false, // Don't fail on missing files
    stripFrontmatter: true
  });

  // Monitor errors
  transclusionStream.on('error', (err: Error) => {
    console.warn(chalk.yellow(`Warning: ${err.message}`));
  });

  await pipeline(
    input,
    transclusionStream,
    output
  );
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
      });
    } catch {
      // Skip if no package.json
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}