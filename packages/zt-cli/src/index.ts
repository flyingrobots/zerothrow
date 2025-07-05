#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { listPackages } from './commands/list.js';
import { packageCommand } from './commands/package.js';
import { validateCommand } from './commands/validate.js';
import { ecosystemCommand } from './commands/ecosystem.js';

// Configure program
program
  .name('zt')
  .description('ZeroThrow CLI - Repo-wide workflow automation')
  .version('0.1.0')
  .allowUnknownOption()
  .configureOutput({
    // Suppress automatic error output to handle external commands
    outputError: () => {},
  });

// Add built-in commands
program
  .command('list')
  .alias('ls')
  .description('List all packages and their versions')
  .action(async () => {
    const result = await listPackages();
    if (!result.ok) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }
  });

const packageCmd = program
  .command('package <subcommand>')
  .description('Package management utilities')
  .option('-v, --verbose', 'Show detailed check results')
  .option('-a, --all', 'Check all packages')
  .option('-p, --package <name>', 'Check specific package')
  .option('-f, --fix', 'Auto-fix issues where possible')
  .option('-n, --name <name>', 'Package name (for init)')
  .option('-d, --description <desc>', 'Package description (for init)')
  .action(async (subcommand, options) => {
    const result = await packageCommand(subcommand, options);
    if (!result.ok) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(2);
    }
  });

packageCmd.addHelpText('after', `
Subcommands:
  ready - Check package readiness for publishing
  init  - Create a new package from template

Examples:
  $ zt package ready                    # Interactive selection
  $ zt package ready --all --verbose    # Check all packages (verbose)
  $ zt package ready --package core     # Check specific package
  $ zt package ready --all              # Silent check (only shows failures)
  $ zt package ready --fix              # Auto-fix issues where possible
  $ zt package ready --all --fix        # Fix all packages
  $ zt package init --name my-package   # Create new package

Exit Codes:
  0 - All selected packages are ready / Package created
  1 - One or more packages are not ready
  2 - Command error

Output Modes:
  --verbose : Shows every check with ✓ or ✗
  --fix     : Auto-fix issues and prompt for manual fixes
  default   : Only shows failures (silence is golden)
`);

program
  .command('validate')
  .description('Run all validation checks (lint, test, build)')
  .option('-f, --fix', 'Auto-fix issues where possible')
  .option('-s, --staged', 'Only validate staged files')
  .action(async (options) => {
    const result = await validateCommand(options);
    if (!result.ok) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(2);
    }
  });

program
  .command('ecosystem <subcommand>')
  .description('Manage ECOSYSTEM.md')
  .action(async (subcommand) => {
    const result = await ecosystemCommand(subcommand);
    if (!result.ok) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(2);
    }
  })
  .addHelpText('after', `
Subcommands:
  sync  - Update ECOSYSTEM.md with current packages
  check - Verify ECOSYSTEM.md is up to date

Examples:
  $ zt ecosystem sync   # Update ECOSYSTEM.md
  $ zt ecosystem check  # Verify in CI
`);

// Handle help specially to avoid conflicts
program.on('command:*', (operands) => {
  const command = operands[0];
  
  // Check if it's a built-in command first
  const cmd = program.commands.find(c => c.name() === command || c.aliases().includes(command));
  if (!cmd) {
    // Try external command
    executeExternalCommand([command, ...operands.slice(1)]);
  }
});

// Parse but handle unknown commands ourselves
try {
  program.parse(process.argv);
} catch (err) {
  // Ignore commander errors, we'll handle them ourselves
}

function executeExternalCommand(args: string[]): void {
  const command = args[0];
  const externalCmd = `zt-${command}`;
  const cmdArgs = args.slice(1);

  // Try to spawn the external command
  const child = spawn(externalCmd, cmdArgs, {
    stdio: 'inherit',
  });

  child.on('error', (err: any) => {
    if (err.code === 'ENOENT') {
      console.error(chalk.red(`Error: Unknown command '${command}'`));
      console.error(chalk.gray(`No built-in command or 'zt-${command}' found in PATH`));
      process.exit(1);
    } else {
      console.error(chalk.red(`Error running '${externalCmd}': ${err.message}`));
      process.exit(1);
    }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
    } else {
      process.exit(code ?? 0);
    }
  });
}