#!/usr/bin/env tsx
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZT, ZeroThrow } from '../../src/index';
import { execCmd } from '../lib/shared';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Benchmark {
  name: string;
  file: string;
  emoji: string;
}

const benchmarks: Benchmark[] = [
  { name: 'Simple benchmarks', file: 'benchmarks.ts', emoji: '📊' },
  { name: 'Advanced benchmarks', file: 'advanced-benchmarks.ts', emoji: '📈' },
  { name: 'Visual benchmarks', file: 'visualize-benchmarks.ts', emoji: '🎨' },
  { name: 'Hero benchmark', file: 'hero-benchmark.ts', emoji: '🏆' },
  { name: 'Concurrent safety', file: 'concurrent-safe-benchmark.ts', emoji: '🔒' },
  { name: 'Error pooling', file: 'error-pooling-benchmark.ts', emoji: '🏊' }
];

async function runBenchmark(bench: Benchmark): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const filePath = join(__dirname, bench.file);
  
  if (!existsSync(filePath)) {
    return ZT.ok(undefined); // Skip missing files
  }
  
  console.log(`\n${bench.emoji} ${chalk.bold(bench.name)}`);
  console.log(chalk.gray('━'.repeat(50)));
  
  const spinner = ora('Running...').start();
  const result = await execCmd(`tsx ${filePath}`);
  
  if (!result.ok) {
    spinner.fail(chalk.red('Failed'));
    return ZT.err(ZeroThrow.wrap(result.error, 'BENCHMARK_FAILED', `Failed to run ${bench.name}`));
  }
  
  spinner.succeed(chalk.green('Completed'));
  console.log(result.value);
  return ZT.ok(undefined);
}

async function main(): Promise<number> {
  console.log(chalk.blue.bold('\n🚀 ZeroThrow Benchmark Suite'));
  console.log(chalk.gray('━'.repeat(50)));
  
  let hasErrors = false;
  
  for (const bench of benchmarks) {
    const result = await runBenchmark(bench);
    if (!result.ok) {
      console.error(chalk.red(`\n❌ ${result.error.message}`));
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.log(chalk.red('\n⚠️  Some benchmarks failed'));
    return 1;
  }
  
  console.log(chalk.green.bold('\n✨ All benchmarks completed successfully!'));
  return 0;
}

main().then(exitCode => process.exit(exitCode));