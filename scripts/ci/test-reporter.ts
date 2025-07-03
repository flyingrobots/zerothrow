#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../../src/index';
import { execCmd, readFile } from '../lib/shared';
import chalk from 'chalk';
import { existsSync } from 'fs';

interface TestResult {
  name: string;
  passed: boolean;
  logFile?: string;
  errorPattern?: RegExp;
}

interface ReportOptions {
  verbose?: boolean;
  showLogs?: boolean;
  maxErrors?: number;
}

const DEFAULT_OPTIONS: ReportOptions = {
  verbose: false,
  showLogs: true,
  maxErrors: 50
};

// Parse test output for errors
async function extractErrors(
  logFile: string,
  pattern: RegExp,
  maxLines: number
): Promise<ZeroThrow.Result<string[], ZeroThrow.ZeroError>> {
  if (!existsSync(logFile)) {
    return ZT.ok([]);
  }
  
  const grepCmd = `grep -E "${pattern.source}" ${logFile} | tail -${maxLines}`;
  const result = await execCmd(grepCmd);
  
  if (!result.ok) {
    return ZT.ok([]); // No matches is not an error
  }
  
  const lines = result.value.split('\n').filter(line => line.trim());
  return ZT.ok(lines);
}

// Format a single test result
function formatTestResult(result: TestResult): string {
  const status = result.passed ? chalk.green('✅') : chalk.red('❌');
  const name = result.passed ? chalk.green(result.name) : chalk.red(result.name);
  return `${status} ${name}: ${result.passed ? 'PASSED' : 'FAILED'}`;
}

// Generate debugging tips based on test type
function getDebuggingTip(testName: string): string {
  const tips: Record<string, string> = {
    'Unit Tests': 'Check for broken imports or syntax errors',
    'Integration Tests': 'Verify external dependencies are mocked',
    'Coverage': "Run 'npm test -- --coverage' to see uncovered lines",
    'Lint': "Run 'npm run lint -- --fix' to auto-fix issues",
    'Build': 'Check for TypeScript errors or missing dependencies'
  };
  
  return tips[testName] || 'Check the error output above';
}

// Generate test report
export async function generateTestReport(
  results: TestResult[],
  options: ReportOptions = {}
): Promise<ZeroThrow.Result<string, ZeroThrow.ZeroError>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];
  
  lines.push(chalk.blue('📊 Test Results Summary:'));
  lines.push(chalk.blue('============================'));
  lines.push('');
  
  // Display results
  for (const result of results) {
    lines.push(formatTestResult(result));
  }
  
  lines.push(chalk.blue('============================'));
  lines.push('');
  
  // Check for failures
  const failedTests = results.filter(r => !r.passed);
  
  if (failedTests.length > 0) {
    lines.push(chalk.red('❌ FAILED JOBS:'));
    lines.push(chalk.red('==============='));
    
    for (const test of failedTests) {
      lines.push(chalk.red(`  🔴 ${test.name}`));
      
      // Extract and show errors if log file exists
      if (opts.showLogs && test.logFile && test.errorPattern) {
        const errorsResult = await extractErrors(
          test.logFile,
          test.errorPattern,
          opts.maxErrors || 50
        );
        
        if (errorsResult.ok && errorsResult.value.length > 0) {
          lines.push(chalk.gray('     Error output:'));
          errorsResult.value.forEach(line => {
            lines.push(chalk.gray(`     ${line}`));
          });
        }
      }
      
      lines.push(chalk.yellow(`     💡 ${getDebuggingTip(test.name)}`));
      lines.push('');
    }
    
    lines.push('');
    lines.push(chalk.yellow('💡 Quick debugging tips:'));
    failedTests.forEach(test => {
      lines.push(chalk.yellow(`  - ${test.name}: ${getDebuggingTip(test.name)}`));
    });
    
    return ZT.err(new ZeroThrow.ZeroError('TESTS_FAILED', 'Some tests failed', {
      failedCount: failedTests.length,
      failedTests: failedTests.map(t => t.name)
    }));
  }
  
  lines.push(chalk.green('✅ All tests passed successfully! 🎉'));
  return ZT.ok(lines.join('\n'));
}

// Parse command line arguments
function parseArgs(): { results: TestResult[]; options: ReportOptions } {
  const args = process.argv.slice(2);
  const results: TestResult[] = [];
  const options: ReportOptions = { ...DEFAULT_OPTIONS };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--test':
        const name = args[++i];
        const passed = args[++i] === 'true';
        const logFile = args[++i] !== 'none' ? args[i] : undefined;
        results.push({ name, passed, logFile });
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-logs':
        options.showLogs = false;
        break;
      case '--max-errors':
        options.maxErrors = parseInt(args[++i], 10) || 50;
        break;
      case '--help':
        console.log('Usage: test-reporter.ts [options]');
        console.log('Options:');
        console.log('  --test <name> <passed> <logFile>  Add test result');
        console.log('  --verbose                         Show verbose output');
        console.log('  --no-logs                         Do not show error logs');
        console.log('  --max-errors <n>                  Maximum error lines to show (default: 50)');
        console.log('  --help                            Show this help message');
        console.log('');
        console.log('Example:');
        console.log('  test-reporter.ts --test "Unit Tests" true none --test "Lint" false lint.log');
        process.exit(0);
    }
  }
  
  return { results, options };
}

// Main function for CLI usage
async function main(): Promise<number> {
  const { results, options } = parseArgs();
  
  if (results.length === 0) {
    console.error(chalk.red('Error: No test results provided'));
    console.error('Use --help for usage information');
    return 1;
  }
  
  // Set error patterns for known test types
  results.forEach(result => {
    if (!result.errorPattern) {
      if (result.name.includes('Test')) {
        result.errorPattern = /(\u2713|\u00d7|FAIL|Error:|at .*:[0-9]+:[0-9]+)/;
      }
    }
  });
  
  const reportResult = await generateTestReport(results, options);
  
  if (reportResult.ok) {
    console.log(reportResult.value);
    return 0;
  } else {
    // Still print the report even on failure
    console.log(reportResult.error.context?.report || '');
    return 1;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(exitCode => process.exit(exitCode));
}