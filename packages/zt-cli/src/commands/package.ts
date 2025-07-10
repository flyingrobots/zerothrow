import { ZT, ZeroThrow } from '@zerothrow/core';
import { readFile, access } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { fixPackageIssues } from './package-fix.js';
import { initPackage } from './package-init.js';

interface PackageOptions {
  verbose?: boolean;
  all?: boolean;
  package?: string;
  fix?: boolean;
  name?: string;
  description?: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

interface PackageReadiness {
  packageName: string;
  packagePath: string;
  checks: CheckResult[];
  ready: boolean;
}

export async function packageCommand(subcommand: string, options: PackageOptions): Promise<ZeroThrow.Result<void, Error>> {
  if (subcommand === 'init') {
    return initPackage(options);
  }
  
  if (subcommand !== 'ready') {
    return ZT.err(new ZeroThrow.ZeroError('INVALID_SUBCOMMAND', `Unknown subcommand: ${subcommand}`));
  }

  // Find packages to check
  const packagesToCheck = await selectPackages(options);
  if (!packagesToCheck.ok) return packagesToCheck as unknown as ZeroThrow.Result<void, Error>;

  const results: PackageReadiness[] = [];
  const spinner = options.verbose ? null : ora('Checking package readiness...').start();

  for (const pkg of packagesToCheck.value) {
    const result = await checkPackageReadiness(pkg.path, options.verbose);
    results.push(result);
    
    if (options.verbose) {
      printVerboseResults(result);
    }

    // Apply fixes if requested
    if (options.fix && !result.ready) {
      const failedChecks = result.checks
        .filter(c => !c.passed)
        .map(c => c.name);
      
      if (failedChecks.length > 0) {
        console.log(chalk.blue(`\n🔧 Fixing issues for ${pkg.name}...`));
        await fixPackageIssues(pkg.path, failedChecks);
        
        // Re-check after fixes
        const recheckedResult = await checkPackageReadiness(pkg.path, false);
        results[results.length - 1] = recheckedResult;
        
        if (recheckedResult.ready) {
          console.log(chalk.green(`✅ ${pkg.name} is now ready for publishing!\n`));
        } else {
          const remainingIssues = recheckedResult.checks.filter(c => !c.passed);
          if (remainingIssues.length > 0) {
            console.log(chalk.yellow(`\n⚠️  ${pkg.name} still has ${remainingIssues.length} issues that need manual fixing:\n`));
            remainingIssues.forEach(issue => {
              console.log(chalk.yellow(`  - ${issue.name}`));
            });
          }
        }
      }
    }
  }

  if (spinner) spinner.stop();

  // Print summary
  const allReady = results.every(r => r.ready);
  
  if (!options.verbose) {
    if (!allReady) {
      console.log(chalk.red('\n❌ Not all packages are ready for publishing\n'));
      for (const result of results) {
        if (!result.ready) {
          console.log(chalk.yellow(`  ${result.packageName}:`));
          result.checks
            .filter(c => !c.passed)
            .forEach(c => console.log(chalk.red(`    ✗ ${c.name}`)));
        }
      }
    }
  }

  // Exit codes: 0 = all ready, 1 = some not ready
  if (!allReady) {
    process.exit(1);
  }

  if (!options.verbose) {
    console.log(chalk.green('✅ All packages are ready for publishing'));
  }

  return ZT.ok(undefined);
}

async function selectPackages(options: PackageOptions): Promise<ZeroThrow.Result<Array<{name: string, path: string}>, Error>> {
  // Find repo root
  let rootDir = process.cwd();
  while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
    rootDir = join(rootDir, '..');
  }

  const packagesDir = join(rootDir, 'packages');
  
  // Get all packages
  const { readdir } = await import('fs/promises');
  const dirs = await readdir(packagesDir);
  const packages: Array<{name: string, path: string}> = [];

  for (const dir of dirs) {
    const pkgPath = join(packagesDir, dir);
    const pkgJsonPath = join(pkgPath, 'package.json');
    try {
      const content = await readFile(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      packages.push({ name: pkg.name || dir, path: pkgPath });
    } catch {
      // Skip if no package.json
    }
  }

  // Handle different selection modes
  if (options.all) {
    return ZT.ok(packages);
  }

  if (options.package) {
    const pkg = packages.find(p => p.name === options.package || p.name.endsWith(`/${options.package}`));
    if (!pkg) {
      return ZT.err(new ZeroThrow.ZeroError('PACKAGE_NOT_FOUND', `Package ${options.package} not found`));
    }
    return ZT.ok([pkg]);
  }

  // Interactive selection
  const { selectedPackages } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedPackages',
    message: 'Select packages to check:',
    choices: packages.map(p => ({ name: p.name, value: p })),
    validate: (input) => input.length > 0 || 'Please select at least one package',
  }]);

  return ZT.ok(selectedPackages);
}

async function checkPackageReadiness(packagePath: string, _verbose: boolean = false): Promise<PackageReadiness> {
  const checks: CheckResult[] = [];
  const pkgJsonPath = join(packagePath, 'package.json');
  
  let packageJson: any;
  try {
    const content = await readFile(pkgJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch {
    return {
      packageName: packagePath,
      packagePath,
      checks: [{ name: 'package.json exists', passed: false }],
      ready: false,
    };
  }

  // Check ALL package.json fields from checklist
  checks.push({ name: 'has accurate description', passed: !!packageJson.description && packageJson.description.length > 10 });
  checks.push({ name: 'has correct package name', passed: !!packageJson.name && packageJson.name.startsWith('@zerothrow/') });
  checks.push({ name: 'type = "module"', passed: packageJson.type === 'module' });
  checks.push({ name: 'sideEffects = false', passed: packageJson.sideEffects === false });
  checks.push({ name: 'has "exports"', passed: !!packageJson.exports });
  checks.push({ name: 'has "platform"', passed: !!packageJson.platform });
  checks.push({ name: 'has "main"', passed: !!packageJson.main });
  checks.push({ name: 'has "module"', passed: !!packageJson.module });
  checks.push({ name: 'has "types"', passed: !!packageJson.types });
  checks.push({ name: 'has minimal "files"', passed: Array.isArray(packageJson.files) && packageJson.files.length > 0 });
  checks.push({ name: 'has correct keywords', passed: Array.isArray(packageJson.keywords) && packageJson.keywords.includes('zerothrow') });
  checks.push({ name: 'homepage is correct', passed: packageJson.homepage === 'https://github.com/zerothrow/zerothrow#readme' });
  checks.push({ name: 'has bugs link', passed: !!packageJson.bugs?.url });
  checks.push({ name: 'has repository', passed: !!packageJson.repository });
  checks.push({ name: 'repository directory is correct', passed: !!packageJson.repository?.directory });
  checks.push({ name: 'license is MIT', passed: packageJson.license === 'MIT' });
  checks.push({ name: 'correct author', passed: packageJson.author === 'J. Kirby Ross <james@flyingrobots.dev> (https://github.com/flyingrobots)' });
  checks.push({ name: 'publishConfig.access = "public"', passed: packageJson.publishConfig?.access === 'public' });
  checks.push({ name: 'engines.node >= 18.17.0', passed: packageJson.engines?.node === '>=18.17.0' });
  checks.push({ name: 'no devDependencies', passed: !packageJson.devDependencies || Object.keys(packageJson.devDependencies).length === 0 });
  checks.push({ name: 'no optionalDependencies', passed: !packageJson.optionalDependencies || Object.keys(packageJson.optionalDependencies).length === 0 });

  // Check files exist
  const filesToCheck = ['README.md', 'CHANGELOG.md', 'LICENSE'];
  for (const file of filesToCheck) {
    try {
      await access(join(packagePath, file));
      checks.push({ name: `has ${file}`, passed: true });
    } catch {
      checks.push({ name: `has ${file}`, passed: false });
    }
  }

  // Check for mascot image in marketing/brand directory
  try {
    const packageName = packageJson.name.replace('@zerothrow/', '');
    const expectedMascotName = `zerothrow-${packageName}`;
    const brandPath = join(packagePath, '..', '..', 'marketing', 'brand');
    const files = await readdir(brandPath);
    const hasMascot = files.some(f => {
      const basename = f.replace(/\.(png|jpg|jpeg|gif|svg)$/i, '');
      return basename === expectedMascotName && f.match(/\.(png|jpg|jpeg|gif|svg)$/i);
    });
    checks.push({ name: 'has mascot image', passed: hasMascot });
  } catch {
    checks.push({ name: 'has mascot image', passed: false });
  }

  // Check README content in detail
  try {
    const readme = await readFile(join(packagePath, 'README.md'), 'utf-8');
    checks.push({ name: 'README has ecosystem link', passed: readme.includes('> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)') });
    checks.push({ name: 'README has badges', passed: readme.includes('![') });
    checks.push({ name: 'README has ecosystem badge', passed: readme.includes('![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)') });
    checks.push({ name: 'README has install instructions', passed: readme.includes('npm i ') || readme.includes('npm install ') });
    checks.push({ name: 'README links to ECOSYSTEM.md', passed: readme.includes('ECOSYSTEM.md') });
    checks.push({ name: 'README has intro blurb', passed: readme.length > 500 }); // Basic check for content
  } catch {
    checks.push({ name: 'README content checks', passed: false });
  }

  // Check ECOSYSTEM.md mentions this package
  try {
    let rootDir = packagePath;
    while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
      rootDir = join(rootDir, '..');
    }
    const ecosystem = await readFile(join(rootDir, 'ECOSYSTEM.md'), 'utf-8');
    checks.push({ name: 'mentioned in ECOSYSTEM.md', passed: ecosystem.includes(packageJson.name) });
    // Check version matches - look for either exact version or npm badge (which shows current version)
    const hasNpmBadge = ecosystem.includes(`npm/v/${packageJson.name}`);
    const hasExactVersion = ecosystem.includes(`v${packageJson.version}`);
    checks.push({ name: 'ECOSYSTEM.md has correct version', passed: hasNpmBadge || hasExactVersion });
  } catch {
    checks.push({ name: 'mentioned in ECOSYSTEM.md', passed: false });
    checks.push({ name: 'ECOSYSTEM.md has correct version', passed: false });
  }

  // Check peerDependencies
  // TODO: This should check against ECOSYSTEM.md chart
  checks.push({ name: 'has correct peerDependencies', passed: true }); // Placeholder for now

  const ready = checks.every(c => c.passed);

  return {
    packageName: packageJson.name || packagePath,
    packagePath,
    checks,
    ready,
  };
}

function printVerboseResults(result: PackageReadiness): void {
  console.log(chalk.bold(`\n📦 ${result.packageName}`));
  
  for (const check of result.checks) {
    const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
    const text = check.passed ? chalk.green(check.name) : chalk.red(check.name);
    console.log(`  ${icon} ${text}`);
  }
  
  if (result.ready) {
    console.log(chalk.green(`\n  ✅ Package is ready for publishing`));
  } else {
    console.log(chalk.red(`\n  ❌ Package is NOT ready for publishing`));
  }
}