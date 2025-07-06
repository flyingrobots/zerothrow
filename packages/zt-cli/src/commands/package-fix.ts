import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

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

  // Add more auto-fixes for common package.json issues
  if (issues.includes('homepage is correct')) {
    fixes.push({
      name: 'homepage is correct',
      fix: async () => {
        packageJson.homepage = 'https://github.com/zerothrow/zerothrow#readme';
        return { fixed: true, value: 'https://github.com/zerothrow/zerothrow#readme' };
      }
    });
  }

  if (issues.includes('has bugs link')) {
    fixes.push({
      name: 'has bugs link',
      fix: async () => {
        packageJson.bugs = { url: 'https://github.com/zerothrow/zerothrow/issues' };
        return { fixed: true, value: 'https://github.com/zerothrow/zerothrow/issues' };
      }
    });
  }

  if (issues.includes('has repository')) {
    fixes.push({
      name: 'has repository',
      fix: async () => {
        const pkgName = packageJson.name.replace('@zerothrow/', '');
        packageJson.repository = {
          type: 'git',
          url: 'https://github.com/zerothrow/zerothrow.git',
          directory: `packages/${pkgName}`
        };
        return { fixed: true, value: JSON.stringify(packageJson.repository) };
      }
    });
  }

  if (issues.includes('license is MIT')) {
    fixes.push({
      name: 'license is MIT',
      fix: async () => {
        packageJson.license = 'MIT';
        return { fixed: true, value: 'MIT' };
      }
    });
  }

  // Auto-fix exports, main, module, types fields for standard packages
  if (issues.includes('has "exports"')) {
    fixes.push({
      name: 'has "exports"',
      fix: async () => {
        packageJson.exports = {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            require: "./dist/index.cjs"
          }
        };
        return { fixed: true, value: 'generated standard exports' };
      }
    });
  }

  if (issues.includes('has "main"')) {
    fixes.push({
      name: 'has "main"',
      fix: async () => {
        packageJson.main = './dist/index.cjs';
        return { fixed: true, value: './dist/index.cjs' };
      }
    });
  }

  if (issues.includes('has "module"')) {
    fixes.push({
      name: 'has "module"',
      fix: async () => {
        packageJson.module = './dist/index.js';
        return { fixed: true, value: './dist/index.js' };
      }
    });
  }

  if (issues.includes('has "types"')) {
    fixes.push({
      name: 'has "types"',
      fix: async () => {
        packageJson.types = './dist/index.d.ts';
        return { fixed: true, value: './dist/index.d.ts' };
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

  // Auto-create missing files
  if (issues.includes('has CHANGELOG.md')) {
    try {
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
    } catch (error) {
      console.log(chalk.red('failed to create CHANGELOG.md'));
    }
  }

  if (issues.includes('has LICENSE')) {
    try {
      const licenseContent = `MIT License

Copyright (c) 2024 ZeroThrow

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
      await writeFile(join(packagePath, 'LICENSE'), licenseContent);
      console.log(chalk.green('fixed: has LICENSE'));
      console.log(chalk.gray('with: Generated LICENSE file\n'));
    } catch (error) {
      console.log(chalk.red('failed to create LICENSE'));
    }
  }

  // Handle non-auto-fixable issues with prompts
  const nonFixableIssues = issues.filter(issue => 
    !fixes.some(f => f.name === issue) && 
    !['has CHANGELOG.md', 'has LICENSE'].includes(issue)
  );
  
  if (nonFixableIssues.length > 0) {
    console.log(chalk.yellow('\n⚠️  Some issues require manual input:\n'));

    // README issues - auto-fix them
    const readmeIssues = nonFixableIssues.filter(i => i.startsWith('README'));
    if (readmeIssues.length > 0) {
      await updateReadme(packagePath, packageJson, readmeIssues);
    }

    // Auto-fix missing description
    if (nonFixableIssues.includes('has accurate description')) {
      const pkgName = packageJson.name.replace('@zerothrow/', '');
      const defaultDescription = `Zero-throw ${pkgName} utilities for TypeScript - part of the ZeroThrow ecosystem`;
      
      packageJson.description = defaultDescription;
      await writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(chalk.green('fixed: has accurate description'));
      console.log(chalk.gray(`with: ${defaultDescription}\n`));
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
    readme = '';
  }

  const updates: string[] = [];

  // If README doesn't exist or is minimal, create a comprehensive one
  if (!readme.trim() || issues.includes('README content checks')) {
    const template = `# ${packageJson.name}

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (\`try\`, \`tryAsync\`, \`ok\`, \`err\`)  
> • **Result** – combinators (\`map\`, \`andThen\`, \`match\`)  
> • **ZeroThrow** – utilities (\`collect\`, \`enhanceAsync\`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/${packageJson.name})
![types](https://img.shields.io/npm/types/${packageJson.name})
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

${packageJson.description || 'Zero-throw error handling for TypeScript.'}

## Installation

\`\`\`bash
npm install ${packageJson.name} @zerothrow/core
# or: pnpm add ${packageJson.name} @zerothrow/core
\`\`\`

## Quick Start

\`\`\`typescript
import { ZT } from '@zerothrow/core'
// TODO: Add usage examples
\`\`\`

## API

TODO: Document the API

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT
`;
    readme = template;
    updates.push('comprehensive README template');
  } else {
    // Apply individual fixes to existing README
    
    // Add ecosystem link at the top
    if (issues.includes('README has ecosystem link')) {
      const ecosystemLink = '\n> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)\n';
      if (!readme.includes('ZeroThrow Ecosystem')) {
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

    // Add badges
    if (issues.includes('README has badges') || issues.includes('README has ecosystem badge')) {
      const badges = `
[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/${packageJson.name})
![types](https://img.shields.io/npm/types/${packageJson.name})
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)
`;
      if (!readme.includes('![ecosystem]')) {
        // Find a good place to insert badges
        const lines = readme.split('\n');
        const ecosystemIndex = lines.findIndex(l => l.includes('ZeroThrow Ecosystem'));
        if (ecosystemIndex >= 0) {
          lines.splice(ecosystemIndex + 1, 0, badges);
          readme = lines.join('\n');
        } else {
          // Insert after first heading
          const titleIndex = lines.findIndex(l => l.startsWith('# '));
          if (titleIndex >= 0) {
            lines.splice(titleIndex + 1, 0, badges);
            readme = lines.join('\n');
          }
        }
        updates.push('badges');
      }
    }

    // Add install instructions
    if (issues.includes('README has install instructions')) {
      const installSection = `\n## Installation\n\n\`\`\`bash\nnpm install ${packageJson.name} @zerothrow/core\n# or: pnpm add ${packageJson.name} @zerothrow/core\n\`\`\`\n`;
      if (!readme.includes('npm install') && !readme.includes('npm i ')) {
        readme += installSection;
        updates.push('install instructions');
      }
    }

    // Add ECOSYSTEM.md link
    if (issues.includes('README links to ECOSYSTEM.md')) {
      if (!readme.includes('ECOSYSTEM.md')) {
        readme += '\n\nSee the [ZeroThrow Ecosystem](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md) for related packages.\n';
        updates.push('ECOSYSTEM.md link');
      }
    }
  }

  await writeFile(readmePath, readme);
  
  if (updates.length > 0) {
    console.log(chalk.green('fixed: README updates'));
    console.log(chalk.gray(`with: ${updates.join(', ')}\n`));
  }
}