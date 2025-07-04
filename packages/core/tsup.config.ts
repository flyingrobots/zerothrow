import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/platform/index.ts',
    'src/dev/error-formatter.ts',
    'src/matchers/index.ts'
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'es2022',
  tsconfig: './tsconfig.json',
  onSuccess: 'echo "✅ Build complete" && rm -f dist/**/*.d.cts'
});