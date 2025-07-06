#!/usr/bin/env node

import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

async function generatePackageInfo() {
  const packagesDir = join(process.cwd(), 'packages');
  const packages = await readdir(packagesDir);
  
  for (const pkgDir of packages) {
    try {
      const packageJsonPath = join(packagesDir, pkgDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      // Generate version file
      const versionPath = join(process.cwd(), 'templates', 'packages', `${pkgDir}-version.md`);
      await writeFile(versionPath, packageJson.version);
      
      // Generate description file
      const descPath = join(process.cwd(), 'templates', 'packages', `${pkgDir}-description.md`);
      await writeFile(descPath, packageJson.description || 'No description');
      
      // Generate full info file
      const infoPath = join(process.cwd(), 'templates', 'packages', `${pkgDir}-info.md`);
      const info = `| [\`${packageJson.name}\`](packages/${pkgDir}) | [![npm](https://img.shields.io/npm/v/${packageJson.name}.svg?style=flat-square)](https://npm.im/${packageJson.name}) | ${packageJson.description || 'No description'} |`;
      await writeFile(infoPath, info);
      
      console.log(`✓ Generated info for ${packageJson.name}`);
    } catch (error) {
      console.error(`✗ Failed to process ${pkgDir}:`, error.message);
    }
  }
}

generatePackageInfo().catch(console.error);