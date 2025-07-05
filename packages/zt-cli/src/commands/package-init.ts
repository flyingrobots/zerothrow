import { ZT, ZeroThrow } from '@zerothrow/core';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface InitOptions {
  name?: string;
  description?: string;
}

export async function initPackage(options: InitOptions): Promise<ZeroThrow.Result<void, Error>> {
  // Get package name
  let packageName = options.name;
  if (!packageName) {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Package name (without @zerothrow/ prefix):',
      validate: (input) => {
        if (!input) return 'Package name is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'Package name must be lowercase letters, numbers, and hyphens only';
        return true;
      }
    }]);
    packageName = name;
  }

  // Get description
  let description = options.description;
  if (!description) {
    const { desc } = await inquirer.prompt([{
      type: 'input',
      name: 'desc',
      message: 'Package description:',
      validate: (input) => input.length > 10 || 'Description must be at least 10 characters',
    }]);
    description = desc;
  }

  // Find repo root
  let rootDir = process.cwd();
  while (!rootDir.endsWith('/zerothrow') && rootDir !== '/') {
    rootDir = join(rootDir, '..');
  }

  const packagePath = join(rootDir, 'packages', packageName!);

  // Check if package already exists
  try {
    await readFile(join(packagePath, 'package.json'));
    return ZT.err(new ZeroThrow.ZeroError('PACKAGE_EXISTS', `Package @zerothrow/${packageName} already exists`));
  } catch {
    // Good, package doesn't exist
  }

  console.log(chalk.blue(`\n📦 Creating package @zerothrow/${packageName}...\n`));

  // Create package directory
  await mkdir(packagePath, { recursive: true });
  await mkdir(join(packagePath, 'src'), { recursive: true });
  await mkdir(join(packagePath, 'test'), { recursive: true });

  // Read template
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, '../../templates/package.json.template');
  const template = await readFile(templatePath, 'utf-8');

  // Replace placeholders
  const packageJson = template
    .replace(/\{\{name\}\}/g, packageName!)
    .replace(/\{\{description\}\}/g, description!)
    .replace(/\{\{keywords\}\}/g, packageName!);

  // Write package.json
  await writeFile(join(packagePath, 'package.json'), packageJson);
  console.log(chalk.green('✓ Created package.json'));

  // Create README.md
  const readme = `# @zerothrow/${packageName}

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)
![npm](https://img.shields.io/npm/v/@zerothrow/${packageName})
![types](https://img.shields.io/npm/types/@zerothrow/${packageName})

${description}

## Installation

\`\`\`bash
npm i @zerothrow/${packageName} @zerothrow/core
\`\`\`

## Usage

\`\`\`typescript
import { ZT } from '@zerothrow/core';
import { /* your exports */ } from '@zerothrow/${packageName}';

// Your usage examples here
\`\`\`

## API

### Functions

Document your API here.

## License

MIT © J. Kirby Ross
`;

  await writeFile(join(packagePath, 'README.md'), readme);
  console.log(chalk.green('✓ Created README.md'));

  // Create CHANGELOG.md
  const changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release
`;

  await writeFile(join(packagePath, 'CHANGELOG.md'), changelog);
  console.log(chalk.green('✓ Created CHANGELOG.md'));

  // Create LICENSE
  const license = `MIT License

Copyright (c) ${new Date().getFullYear()} J. Kirby Ross

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

  await writeFile(join(packagePath, 'LICENSE'), license);
  console.log(chalk.green('✓ Created LICENSE'));

  // Create index.ts
  const indexTs = `// SPDX-License-Identifier: MIT
// Copyright (c) ${new Date().getFullYear()} J. Kirby Ross

/**
 * @module @zerothrow/${packageName}
 * @description ${description}
 */

import { ZT, ZeroThrow } from '@zerothrow/core';

// Your code here

export {
  // Your exports here
};
`;

  await writeFile(join(packagePath, 'src/index.ts'), indexTs);
  console.log(chalk.green('✓ Created src/index.ts'));

  // Create tsconfig.json
  const tsconfig = {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src",
      composite: true,
      tsBuildInfoFile: "./dist/.tsbuildinfo"
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "**/*.test.ts"],
    references: [
      { path: "../core" }
    ]
  };

  await writeFile(join(packagePath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  console.log(chalk.green('✓ Created tsconfig.json'));

  // Create tsup.config.ts
  const tsupConfig = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
});
`;

  await writeFile(join(packagePath, 'tsup.config.ts'), tsupConfig);
  console.log(chalk.green('✓ Created tsup.config.ts'));

  // Create test file
  const testFile = `// SPDX-License-Identifier: MIT
// Copyright (c) ${new Date().getFullYear()} J. Kirby Ross

import { describe, it, expect } from 'vitest';
// import { } from '../src/index.js';

describe('@zerothrow/${packageName}', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`;

  await writeFile(join(packagePath, 'test/index.test.ts'), testFile);
  console.log(chalk.green('✓ Created test/index.test.ts'));

  // Create mascot.svg placeholder
  const mascotSvg = `<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) ${new Date().getFullYear()} J. Kirby Ross -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="80" fill="#3178c6"/>
  <text x="100" y="110" font-family="Arial" font-size="60" text-anchor="middle" fill="white">ZT</text>
</svg>`;

  await writeFile(join(packagePath, 'mascot.svg'), mascotSvg);
  console.log(chalk.green('✓ Created mascot.svg placeholder'));

  console.log(chalk.green(`\n✅ Package @zerothrow/${packageName} created successfully!\n`));
  console.log(chalk.gray(`Location: ${packagePath}`));
  console.log(chalk.gray(`\nNext steps:`));
  console.log(chalk.gray(`  1. cd packages/${packageName}`));
  console.log(chalk.gray(`  2. npm install`));
  console.log(chalk.gray(`  3. npm run build`));
  console.log(chalk.gray(`  4. zt package ready --package ${packageName} --verbose`));

  return ZT.ok(undefined);
}