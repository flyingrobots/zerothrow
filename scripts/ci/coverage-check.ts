#!/usr/bin/env tsx
import { Result, ok, err, ZeroError } from '../../src/index';
import { readFile } from '../lib/shared';
import chalk from 'chalk';

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummary {
  total: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
  };
}

interface CoverageCheckConfig {
  threshold: number;
  summaryPath: string;
}

const DEFAULT_CONFIG: CoverageCheckConfig = {
  threshold: 90,
  summaryPath: './coverage/coverage-summary.json'
};

// Parse command line arguments
function parseArgs(): CoverageCheckConfig {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--threshold':
        const threshold = parseFloat(args[i + 1]);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
          config.threshold = threshold;
        }
        i++;
        break;
      case '--summary':
        config.summaryPath = args[i + 1];
        i++;
        break;
      case '--help':
        console.log('Usage: coverage-check.ts [options]');
        console.log('Options:');
        console.log('  --threshold <number>  Coverage threshold percentage (default: 90)');
        console.log('  --summary <path>      Path to coverage-summary.json (default: ./coverage/coverage-summary.json)');
        console.log('  --help               Show this help message');
        process.exit(0);
    }
  }
  
  return config;
}

// Read and parse coverage summary
async function readCoverageSummary(path: string): Promise<Result<CoverageSummary, ZeroError>> {
  const fileResult = await readFile(path);
  if (!fileResult.ok) {
    return err(new ZeroError('COVERAGE_FILE_NOT_FOUND', 'Coverage summary file not found', {
      path,
      hint: 'Run tests with coverage first: npm test -- --coverage'
    }));
  }
  
  try {
    const summary = JSON.parse(fileResult.value) as CoverageSummary;
    return ok(summary);
  } catch (e) {
    return err(new ZeroError('INVALID_COVERAGE_FORMAT', 'Invalid coverage summary format', {
      path,
      error: (e as Error).message
    }));
  }
}

// Check coverage against threshold
function checkCoverage(summary: CoverageSummary, threshold: number): Result<void, ZeroError> {
  const metrics = ['lines', 'statements', 'functions', 'branches'] as const;
  const results: Array<{ metric: string; pct: number; passed: boolean }> = [];
  let allPassed = true;
  
  console.log(chalk.blue('📊 Coverage Summary:'));
  console.log(chalk.blue('=================='));
  
  for (const metric of metrics) {
    const pct = summary.total[metric].pct;
    const passed = pct >= threshold;
    results.push({ metric, pct, passed });
    
    const status = passed ? chalk.green('✅') : chalk.red('❌');
    const pctColor = passed ? chalk.green : chalk.red;
    console.log(`${status} ${metric}: ${pctColor(pct.toFixed(2) + '%')}`);
    
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log('');
  
  if (!allPassed) {
    console.error(chalk.red(`❌ Coverage is below the ${threshold}% threshold!`));
    console.error('');
    console.error(chalk.yellow('To see which lines are not covered:'));
    console.error(chalk.yellow('1. Run: npm test -- --coverage'));
    console.error(chalk.yellow('2. Check the coverage/lcov-report/index.html file'));
    
    const failedMetrics = results.filter(r => !r.passed);
    return err(new ZeroError('COVERAGE_THRESHOLD_NOT_MET', 'Coverage below threshold', {
      threshold,
      failedMetrics
    }));
  }
  
  console.log(chalk.green(`✅ All coverage metrics meet the >${threshold}% threshold`));
  return ok(undefined);
}

// Export for programmatic use
export async function checkCoverageThreshold(
  config: Partial<CoverageCheckConfig> = {}
): Promise<Result<void, ZeroError>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const summaryResult = await readCoverageSummary(finalConfig.summaryPath);
  if (!summaryResult.ok) {
    return summaryResult;
  }
  
  return checkCoverage(summaryResult.value, finalConfig.threshold);
}

// Main function for CLI usage
async function main(): Promise<number> {
  const config = parseArgs();
  
  const result = await checkCoverageThreshold(config);
  return result.ok ? 0 : 1;
}

// Run if called directly
if (require.main === module) {
  main().then(exitCode => process.exit(exitCode));
}