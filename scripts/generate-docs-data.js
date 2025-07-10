#!/usr/bin/env node

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

async function generateDocsData() {
  const packagesDir = join(process.cwd(), 'packages');
  const packages = await readdir(packagesDir);
  
  for (const pkgDir of packages) {
    try {
      const packageJsonPath = join(packagesDir, pkgDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      const docsDataPath = join(packagesDir, pkgDir, 'docs.data.md');
      const content = `### badge
![npm](https://img.shields.io/npm/v/${packageJson.name})

### description
${packageJson.description || 'Zero-throw utilities for TypeScript'}

### version
${packageJson.version}

### quickstart
\`\`\`typescript
import { ZT } from '@zerothrow/core';
// TODO: Add ${pkgDir} specific examples
\`\`\`

### api
TODO: Document the ${packageJson.name} API

### examples
See the [examples directory](https://github.com/zerothrow/zerothrow/tree/main/examples) for full examples.
`;
      
      await writeFile(docsDataPath, content);
      console.log(`✓ Generated docs.data.md for ${packageJson.name}`);
    } catch (error) {
      console.error(`✗ Failed to process ${pkgDir}:`, error.message);
    }
  }
}

generateDocsData().catch(console.error);