#!/usr/bin/env node
import { writeFileSync, chmodSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const ztCliPath = join(projectRoot, 'packages/zt-cli/src/index.ts');

// Create a wrapper script that uses tsx to run the TypeScript directly
const wrapperScript = `#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Run tsx with the zt-cli TypeScript file
const tsxPath = '${join(projectRoot, 'node_modules/.bin/tsx')}';
const cliPath = '${ztCliPath}';

import { spawn } from 'child_process';

const child = spawn(tsxPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
`;

// Try to write to /usr/local/bin/zt (may need sudo)
try {
  const ztPath = '/usr/local/bin/zt';
  writeFileSync(ztPath, wrapperScript);
  chmodSync(ztPath, '755');
  console.log('✅ Installed zt command globally (dev mode - always runs latest code)');
  console.log('   You can now use "zt" from anywhere!');
} catch (err) {
  // Fallback: create a local bin script
  console.log('⚠️  Could not write to /usr/local/bin/zt (need sudo)');
  console.log('   Creating local version instead...\n');
  
  const localZtPath = join(projectRoot, 'zt');
  writeFileSync(localZtPath, wrapperScript);
  chmodSync(localZtPath, '755');
  
  console.log('✅ Created ./zt command (dev mode - always runs latest code)');
  console.log('   Usage: ./zt package ready --all');
  console.log('\n   To install globally, run:');
  console.log('   sudo npm run zt:install');
}