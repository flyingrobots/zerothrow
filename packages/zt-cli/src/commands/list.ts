import { ZT, ZeroThrow } from '@zerothrow/core';
import { readFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface PackageInfo {
  name: string;
  version: string;
  path: string;
  private?: boolean;
}

export async function listPackages(): Promise<ZeroThrow.Result<void, Error>> {
  const spinner = ora('Scanning for packages...').start();

  try {
    // Find all package.json files
    // Go up to find the root directory with packages/
    let rootDir = process.cwd();
    while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
      rootDir = join(rootDir, '..');
    }
    const packagesDir = join(rootDir, 'packages');
    const dirs = await readdir(packagesDir);
    const packageFiles: string[] = [];
    
    for (const dir of dirs) {
      const packageJsonPath = join(packagesDir, dir, 'package.json');
      try {
        await readFile(packageJsonPath);
        packageFiles.push(packageJsonPath);
      } catch {
        // Skip if no package.json
      }
    }

    spinner.stop();

    if (packageFiles.length === 0) {
      console.log(chalk.yellow('No packages found in packages/ directory'));
      return ZT.ok(undefined);
    }

    const packages: PackageInfo[] = [];

    // Read all package.json files
    for (const file of packageFiles) {
      const contentResult = await ZT.tryAsync(async () => {
        const content = await readFile(file, 'utf-8');
        return JSON.parse(content);
      });

      if (!contentResult.ok) {
        console.warn(chalk.yellow(`Warning: Could not read ${file}`));
        continue;
      }

      const pkg = contentResult.value;
      packages.push({
        name: pkg.name || 'unnamed',
        version: pkg.version || 'unknown',
        path: file.replace('/package.json', ''),
        private: pkg.private,
      });
    }

    // Sort by name
    packages.sort((a, b) => a.name.localeCompare(b.name));

    // Display results
    console.log(chalk.bold.blue('\n📦 ZeroThrow Packages\n'));

    const maxNameLength = Math.max(...packages.map(p => p.name.length));

    for (const pkg of packages) {
      const name = pkg.name.padEnd(maxNameLength + 2);
      const version = chalk.green(`v${pkg.version}`);
      const privateLabel = pkg.private ? chalk.gray(' (private)') : '';
      
      console.log(`  ${chalk.cyan(name)} ${version}${privateLabel}`);
    }

    console.log(chalk.gray(`\nTotal: ${packages.length} packages\n`));

    return ZT.ok(undefined);
  } catch (error) {
    spinner.stop();
    return ZT.err(
      new ZeroThrow.ZeroError(
        'LIST_PACKAGES_ERROR',
        `Failed to list packages: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
  }
}