import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface FixableIssue {
  name: string;
  fix: () => Promise<{ fixed: boolean; value?: string }>;
}

export async function fixPackageIssues(packagePath: string, issues: string[]): Promise<void> {
  const pkgJsonPath = join(packagePath, 'package.json');
  let packageJson: any;
  
  try {
    const content = await readFile(pkgJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch {
    console.error(chalk.red('Could not read package.json'));
    return;
  }

  const fixes: FixableIssue[] = [];

  // Auto-fixable package.json fields
  if (issues.includes('sideEffects = false')) {
    fixes.push({
      name: 'sideEffects = false',
      fix: async () => {
        packageJson.sideEffects = false;
        return { fixed: true, value: 'false' };
      }
    });
  }

  if (issues.includes('has "platform"')) {
    fixes.push({
      name: 'has "platform"',
      fix: async () => {
        packageJson.platform = 'universal';
        return { fixed: true, value: '"universal"' };
      }
    });
  }

  if (issues.includes('has "dev"')) {
    fixes.push({
      name: 'has "dev"',
      fix: async () => {
        packageJson.dev = false;
        return { fixed: true, value: 'false' };
      }
    });
  }

  if (issues.includes('correct author')) {
    fixes.push({
      name: 'correct author',
      fix: async () => {
        packageJson.author = 'J. Kirby Ross <james@flyingrobots.dev> (https://github.com/flyingrobots)';
        return { fixed: true, value: 'J. Kirby Ross <james@flyingrobots.dev> (https://github.com/flyingrobots)' };
      }
    });
  }

  if (issues.includes('publishConfig.access = "public"')) {
    fixes.push({
      name: 'publishConfig.access = "public"',
      fix: async () => {
        packageJson.publishConfig = { access: 'public' };
        return { fixed: true, value: '{ "access": "public" }' };
      }
    });
  }

  if (issues.includes('engines.node >= 18.17.0')) {
    fixes.push({
      name: 'engines.node >= 18.17.0',
      fix: async () => {
        packageJson.engines = { node: '>=18.17.0' };
        return { fixed: true, value: '{ "node": ">=18.17.0" }' };
      }
    });
  }

  if (issues.includes('no devDependencies')) {
    fixes.push({
      name: 'no devDependencies',
      fix: async () => {
        delete packageJson.devDependencies;
        return { fixed: true, value: 'removed devDependencies' };
      }
    });
  }

  if (issues.includes('no optionalDependencies')) {
    fixes.push({
      name: 'no optionalDependencies',
      fix: async () => {
        delete packageJson.optionalDependencies;
        return { fixed: true, value: 'removed optionalDependencies' };
      }
    });
  }

  if (issues.includes('has correct keywords')) {
    fixes.push({
      name: 'has correct keywords',
      fix: async () => {
        if (!Array.isArray(packageJson.keywords)) {
          packageJson.keywords = [];
        }
        if (!packageJson.keywords.includes('zerothrow')) {
          packageJson.keywords.push('zerothrow');
        }
        return { fixed: true, value: JSON.stringify(packageJson.keywords) };
      }
    });
  }

  if (issues.includes('repository directory is correct')) {
    fixes.push({
      name: 'repository directory is correct',
      fix: async () => {
        if (!packageJson.repository) {
          packageJson.repository = {};
        }
        if (typeof packageJson.repository === 'object') {
          const pkgName = packageJson.name.replace('@zerothrow/', '');
          packageJson.repository.directory = `packages/${pkgName}`;
          return { fixed: true, value: `packages/${pkgName}` };
        }
        return { fixed: false };
      }
    });
  }

  // Apply auto-fixes
  console.log(chalk.blue('\n🔧 Auto-fixing issues...\n'));
  
  for (const fix of fixes) {
    const result = await fix.fix();
    if (result.fixed) {
      console.log(chalk.green(`fixed: ${fix.name}`));
      console.log(chalk.gray(`with: ${result.value}\n`));
    }
  }

  // Write updated package.json
  if (fixes.length > 0) {
    await writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  // Handle non-auto-fixable issues with prompts
  const nonFixableIssues = issues.filter(issue => !fixes.some(f => f.name === issue));
  
  if (nonFixableIssues.length > 0) {
    console.log(chalk.yellow('\n⚠️  Some issues require manual input:\n'));

    // Missing files
    if (nonFixableIssues.includes('has CHANGELOG.md')) {
      const { createChangelog } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createChangelog',
        message: 'Create CHANGELOG.md?',
        default: true,
      }]);

      if (createChangelog) {
        const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [${packageJson.version}] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release
`;
        await writeFile(join(packagePath, 'CHANGELOG.md'), changelogContent);
        console.log(chalk.green('fixed: has CHANGELOG.md'));
        console.log(chalk.gray('with: Generated CHANGELOG.md\n'));
      }
    }

    // README issues
    const readmeIssues = nonFixableIssues.filter(i => i.startsWith('README'));
    if (readmeIssues.length > 0) {
      const { fixReadme } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fixReadme',
        message: 'Update README.md with required sections?',
        default: true,
      }]);

      if (fixReadme) {
        await updateReadme(packagePath, packageJson, readmeIssues);
      }
    }

    // Missing description
    if (nonFixableIssues.includes('has accurate description')) {
      const { description } = await inquirer.prompt([{
        type: 'input',
        name: 'description',
        message: 'Enter package description:',
        validate: (input) => input.length > 10 || 'Description must be at least 10 characters',
      }]);

      packageJson.description = description;
      await writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(chalk.green('fixed: has accurate description'));
      console.log(chalk.gray(`with: ${description}\n`));
    }

    // Missing fields that need user input
    if (nonFixableIssues.includes('has "exports"')) {
      console.log(chalk.yellow('\n⚠️  "exports" field needs manual configuration'));
      console.log(chalk.gray('Add to package.json:'));
      console.log(chalk.gray(JSON.stringify({
        exports: {
          '.': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
            require: './dist/index.cjs',
          }
        }
      }, null, 2)));
    }
  }
}

async function updateReadme(packagePath: string, packageJson: any, issues: string[]): Promise<void> {
  const readmePath = join(packagePath, 'README.md');
  let readme = '';

  try {
    readme = await readFile(readmePath, 'utf-8');
  } catch {
    // Create new README if it doesn't exist
  }

  const updates: string[] = [];

  // Add ecosystem link at the top
  if (issues.includes('README has ecosystem link')) {
    const ecosystemLink = '\n> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)\n';
    if (!readme.includes(ecosystemLink)) {
      // Insert after title
      const lines = readme.split('\n');
      const titleIndex = lines.findIndex(l => l.startsWith('# '));
      if (titleIndex >= 0) {
        lines.splice(titleIndex + 1, 0, ecosystemLink);
        readme = lines.join('\n');
      } else {
        readme = `# ${packageJson.name}\n${ecosystemLink}\n${readme}`;
      }
      updates.push('ecosystem link');
    }
  }

  // Add ecosystem badge
  if (issues.includes('README has ecosystem badge')) {
    const badge = '![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)';
    if (!readme.includes(badge)) {
      // Add to badge section or create one
      const badgeSection = `\n${badge}\n`;
      const lines = readme.split('\n');
      const ecosystemIndex = lines.findIndex(l => l.includes('ZeroThrow Ecosystem'));
      if (ecosystemIndex >= 0) {
        lines.splice(ecosystemIndex + 2, 0, badgeSection);
        readme = lines.join('\n');
      }
      updates.push('ecosystem badge');
    }
  }

  // Add install instructions
  if (issues.includes('README has install instructions')) {
    const installSection = `\n## Installation\n\n\`\`\`bash\nnpm i ${packageJson.name}\n\`\`\`\n`;
    if (!readme.includes('npm i')) {
      readme += installSection;
      updates.push('install instructions');
    }
  }

  await writeFile(readmePath, readme);
  
  if (updates.length > 0) {
    console.log(chalk.green('fixed: README updates'));
    console.log(chalk.gray(`with: Added ${updates.join(', ')}\n`));
  }
}