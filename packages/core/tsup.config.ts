import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/react-hooks.ts',
    'src/loggers/pino.ts',
    'src/loggers/winston.ts',
    'src/platform/index.ts',
    'src/eslint/index.ts'
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
  esbuildOptions(options, context) {
    // Use relaxed tsconfig for logger files
    if (context.entry?.includes('loggers')) {
      options.tsconfig = './tsconfig.loggers.json';
    }
  },
  onSuccess: 'echo "✅ Build complete"'
});