#!/usr/bin/env tsx
import { ZT, ZeroThrow } from '../../packages/core/src/index';
import chalk from 'chalk';
import * as fs from 'fs';

// Valid packages from CLAUDE.md
const VALID_PACKAGES = [
  'core', 'resilience', 'jest', 'vitest', 'testing', 'expect', 
  'docker', 'zt-cli', 'eslint-plugin', 'react', 'monorepo', 
  'docs', 'ci', 'scripts'
];

// Valid commit types
const VALID_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 
  'test', 'chore', 'perf', 'build', 'ci'
];

// Patterns
const PACKAGE_PATTERN = new RegExp(`^\\[(${VALID_PACKAGES.join('|')})\\] (${VALID_TYPES.join('|')}): .+ \\(#[0-9]+\\)$`);
const TYPE_PATTERN = new RegExp(`^(${VALID_TYPES.join('|')}): .+ \\(#[0-9]+\\)$`);
const RELEASE_PATTERN = /^chore: release v[0-9]+\.[0-9]+\.[0-9]+.*$/;
const MERGE_PATTERN = /^Merge /;

type ValidationResult = {
  valid: boolean;
  issueNumber?: string;
  errors: string[];
  warnings: string[];
};

// Read commit message from file
function readCommitMessage(filePath: string): ZeroThrow.Result<string, ZeroThrow.ZeroError> {
  return ZT.try(() => fs.readFileSync(filePath, 'utf8'))
    .mapErr(err => new ZeroThrow.ZeroError('READ_FAILED', 'Failed to read commit message file', { cause: err }));
}

// Validate commit message format
function validateCommitMessage(message: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get first line
  const firstLine = message.split('\n')[0];
  
  // Check special cases that don't need issue numbers
  if (MERGE_PATTERN.test(firstLine)) {
    return { valid: true, errors, warnings };
  }
  
  if (RELEASE_PATTERN.test(firstLine)) {
    return { valid: true, errors, warnings };
  }
  
  // Check main patterns
  const packageMatch = PACKAGE_PATTERN.test(firstLine);
  const typeMatch = TYPE_PATTERN.test(firstLine);
  
  if (!packageMatch && !typeMatch) {
    errors.push('Invalid commit message format');
    errors.push('Expected: [package] type: subject (#issue-number)');
    errors.push('      OR: type: subject (#issue-number)');
    errors.push('');
    errors.push(`Your message: ${firstLine}`);
    
    // Check for common mistakes
    if (!firstLine.includes('#')) {
      errors.push('');
      errors.push('❌ Missing issue reference! Every commit MUST reference a GitHub issue.');
    }
    
    const typeRegex = new RegExp(`^(\\[\\w+\\] )?(${VALID_TYPES.join('|')}):`);
    if (!typeRegex.test(firstLine)) {
      errors.push('');
      errors.push(`❌ Invalid or missing type. Valid types: ${VALID_TYPES.join(', ')}`);
    }
    
    const packageRegex = /^\[(\w+)\]/;
    const packageMatch = firstLine.match(packageRegex);
    if (packageMatch && !VALID_PACKAGES.includes(packageMatch[1])) {
      errors.push('');
      errors.push(`❌ Invalid package '${packageMatch[1]}'. Valid packages: ${VALID_PACKAGES.join(', ')}`);
    }
    
    return { valid: false, errors, warnings };
  }
  
  // Extract issue number
  const issueMatch = firstLine.match(/#([0-9]+)/);
  const issueNumber = issueMatch ? issueMatch[1] : undefined;
  
  // Check for Closes #issue in body
  if (issueNumber && !message.includes(`Closes #${issueNumber}`)) {
    warnings.push(`Consider adding 'Closes #${issueNumber}' to the commit body`);
  }
  
  return { 
    valid: true, 
    issueNumber,
    errors, 
    warnings 
  };
}

// Format error output
function formatError(result: ValidationResult): string {
  const output: string[] = [];
  
  output.push(chalk.red('✗ ERROR: Invalid commit message format!'));
  output.push('');
  
  result.errors.forEach(error => output.push(error));
  
  output.push('');
  output.push('Examples:');
  output.push('  [core] feat: add Result.tap method for side effects (#123)');
  output.push('  [jest] fix: handle undefined values in toBeOkWith matcher (#124)');
  output.push('  chore: update dependencies across packages (#125)');
  output.push('');
  output.push(`Valid packages: ${VALID_PACKAGES.join(', ')}`);
  output.push(`Valid types: ${VALID_TYPES.join(', ')}`);
  output.push('');
  output.push(chalk.red('REMINDER: Every commit MUST reference a GitHub issue!'));
  output.push('- Find an existing issue: gh issue list --search "keywords"');
  output.push('- Create a new issue: gh issue create --title "description"');
  
  return output.join('\n');
}

// Main function
async function main(): Promise<number> {
  // Get commit message file path from command line argument
  const commitMsgFile = process.argv[2];
  
  if (!commitMsgFile) {
    console.error(chalk.red('Error: No commit message file provided'));
    return 1;
  }
  
  // Read and validate commit message
  const result = readCommitMessage(commitMsgFile)
    .map(validateCommitMessage)
    .tapErr(err => console.error(chalk.red(`Error: ${err.message}`)));
  
  if (!result.ok) {
    return 1;
  }
  
  const validation = result.value;
  
  // Handle warnings
  validation.warnings.forEach(warning => {
    console.log(chalk.yellow(`⚠️  Warning: ${warning}`));
  });
  
  // Handle validation result
  if (!validation.valid) {
    console.error(formatError(validation));
    return 1;
  }
  
  console.log(chalk.green('✓ Commit message format is valid'));
  
  if (validation.issueNumber) {
    console.log(chalk.gray(`  References issue #${validation.issueNumber}`));
  }
  
  return 0;
}

// Run the hook
main().then(exitCode => process.exit(exitCode));