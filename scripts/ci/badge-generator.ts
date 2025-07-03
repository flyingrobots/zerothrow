#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../../packages/core/src/index';
import { readFile, writeFile, execCmd } from '../lib/shared';
import chalk from 'chalk';
import { join } from 'path';

interface BadgeConfig {
  label: string;
  value: string | number;
  color?: string;
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge';
  logo?: string;
  logoColor?: string;
  outputPath?: string;
}

interface CoverageBadgeConfig {
  summaryPath: string;
  outputPath?: string;
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge';
  thresholds?: {
    good: number;
    medium: number;
  };
}

const DEFAULT_COVERAGE_CONFIG: CoverageBadgeConfig = {
  summaryPath: './coverage/coverage-summary.json',
  outputPath: './coverage.svg',
  style: 'flat',
  thresholds: {
    good: 80,
    medium: 60
  }
};

// Generate shield.io badge URL
function generateBadgeUrl(config: BadgeConfig): string {
  const { label, value, color = 'blue', style = 'flat', logo, logoColor } = config;
  
  // Encode values for URL
  const encodedLabel = encodeURIComponent(label);
  const encodedValue = encodeURIComponent(String(value));
  
  let url = `https://img.shields.io/badge/${encodedLabel}-${encodedValue}-${color}`;
  
  const params: string[] = [];
  if (style !== 'flat') params.push(`style=${style}`);
  if (logo) params.push(`logo=${logo}`);
  if (logoColor) params.push(`logoColor=${logoColor}`);
  
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  
  return url;
}

// Download badge from shields.io
async function downloadBadge(url: string, outputPath: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const result = await execCmd(`curl -s "${url}" -o "${outputPath}"`);
  
  if (!result.ok) {
    const errorResult = result as ZeroThrow.Err<ZeroThrow.ZeroError>;
    return ZT.err(new ZeroThrow.ZeroError('BADGE_DOWNLOAD_FAILED', 'Failed to download badge', {
      context: {
        url,
        outputPath,
        error: errorResult.error.message
      }
    }));
  }
  
  return ZT.ok(undefined);
}

// Calculate average coverage from summary
function calculateAverageCoverage(summary: any): number {
  const total = summary.total;
  const metrics = ['lines', 'statements', 'functions', 'branches'];
  
  const sum = metrics.reduce((acc, metric) => {
    return acc + (total[metric]?.pct || 0);
  }, 0);
  
  return Math.round(sum / metrics.length);
}

// Determine badge color based on coverage
function getCoverageColor(coverage: number, thresholds: { good: number; medium: number }): string {
  if (coverage >= thresholds.good) return 'green';
  if (coverage >= thresholds.medium) return 'yellow';
  return 'red';
}

// Generate coverage badge
export async function generateCoverageBadge(
  config: Partial<CoverageBadgeConfig> = {}
): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const cfg = { ...DEFAULT_COVERAGE_CONFIG, ...config };
  
  // Read coverage summary
  const summaryResult = await readFile(cfg.summaryPath);
  if (!summaryResult.ok) {
    return ZT.err(new ZeroThrow.ZeroError('COVERAGE_FILE_NOT_FOUND', 'Coverage summary not found', {
      context: {
        path: cfg.summaryPath,
        hint: 'Run tests with coverage first: npm test -- --coverage'
      }
    }));
  }
  
  // Parse summary
  const parseResult = await ZT.try(
    () => JSON.parse(summaryResult.value),
    e => new ZeroThrow.ZeroError('INVALID_COVERAGE_FORMAT', 'Invalid coverage summary format', {
      context: {
        error: (e as Error).message
      }
    })
  );
  
  if (!parseResult.ok) return parseResult;
  
  const coverage = calculateAverageCoverage(parseResult.value);
  const color = getCoverageColor(coverage, cfg.thresholds!);
  
  console.log(chalk.blue(`📊 Coverage: ${coverage}%`));
  console.log(chalk.blue(`🎨 Badge color: ${color}`));
  
  // Generate badge
  const badgeConfig: BadgeConfig = {
    label: 'coverage',
    value: `${coverage}%`,
    color,
    style: cfg.style,
    outputPath: cfg.outputPath
  };
  
  const url = generateBadgeUrl(badgeConfig);
  console.log(chalk.gray(`🔗 Badge URL: ${url}`));
  
  if (cfg.outputPath) {
    const downloadResult = await downloadBadge(url, cfg.outputPath);
    if (!downloadResult.ok) return downloadResult;
    
    console.log(chalk.green(`✅ Badge saved to: ${cfg.outputPath}`));
  }
  
  return ZT.ok(undefined);
}

// Generate custom badge
export async function generateCustomBadge(config: BadgeConfig): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  const url = generateBadgeUrl(config);
  console.log(chalk.blue(`🎯 Generating badge: ${config.label} - ${config.value}`));
  console.log(chalk.gray(`🔗 Badge URL: ${url}`));
  
  if (config.outputPath) {
    const downloadResult = await downloadBadge(url, config.outputPath);
    if (!downloadResult.ok) return downloadResult;
    
    console.log(chalk.green(`✅ Badge saved to: ${config.outputPath}`));
  }
  
  return ZT.ok(undefined);
}

// Parse command line arguments
function parseArgs(): { type: 'coverage' | 'custom'; config: any } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: badge-generator.ts <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  coverage              Generate coverage badge from test results');
    console.log('  custom                Generate custom badge');
    console.log('');
    console.log('Coverage options:');
    console.log('  --summary <path>      Path to coverage-summary.json');
    console.log('  --output <path>       Output path for badge SVG');
    console.log('  --style <style>       Badge style (flat, flat-square, plastic, for-the-badge)');
    console.log('  --good <n>            Threshold for green badge (default: 80)');
    console.log('  --medium <n>          Threshold for yellow badge (default: 60)');
    console.log('');
    console.log('Custom options:');
    console.log('  --label <text>        Badge label');
    console.log('  --value <text>        Badge value');
    console.log('  --color <color>       Badge color');
    console.log('  --style <style>       Badge style');
    console.log('  --logo <name>         Logo name (e.g., typescript, github)');
    console.log('  --output <path>       Output path for badge SVG');
    console.log('');
    console.log('Examples:');
    console.log('  badge-generator.ts coverage --output ./badges/coverage.svg');
    console.log('  badge-generator.ts custom --label "build" --value "passing" --color "green"');
    process.exit(0);
  }
  
  const command = args[0];
  const config: any = {};
  
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'good' || key === 'medium') {
      config.thresholds = config.thresholds || {};
      config.thresholds[key] = parseInt(value, 10);
    } else {
      config[key === 'summary' ? 'summaryPath' : key === 'output' ? 'outputPath' : key] = value;
    }
  }
  
  return { type: command as 'coverage' | 'custom', config };
}

// Main function
async function main(): Promise<number> {
  const { type, config } = parseArgs();
  
  let result: ZeroThrow.Result<void, ZeroThrow.ZeroError>;
  
  if (type === 'coverage') {
    result = await generateCoverageBadge(config);
  } else if (type === 'custom') {
    if (!config.label || !config.value) {
      console.error(chalk.red('Error: --label and --value are required for custom badges'));
      return 1;
    }
    result = await generateCustomBadge(config);
  } else {
    console.error(chalk.red(`Unknown command: ${type}`));
    return 1;
  }
  
  return result.ok ? 0 : 1;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(exitCode => process.exit(exitCode));
}