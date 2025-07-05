import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  format: ['esm', 'cjs'],
  dts: false, // TODO: Fix TypeScript errors
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist',
  target: 'node18',
  esbuildOptions(options) {
    options.banner = {
      js: '#!/usr/bin/env node'
    };
  }
});