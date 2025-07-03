#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Result, ok, err, ZeroError, tryR } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExampleConfig {
  name: string;
  description: string;
  directory: string;
  service: string;
}

interface ValidationResult {
  example: string;
  passed: boolean;
  issues: string[];
}

interface TestResult {
  example: string;
  passed: boolean;
  output: string;
  error?: string;
}

const EXAMPLES: ExampleConfig[] = [
  {
    name: 'react',
    description: 'React Examples',
    directory: 'react',
    service: 'react-examples'
  },
  {
    name: 'node',
    description: 'Node.js Examples',
    directory: 'node',
    service: 'node-examples'
  },
  {
    name: 'database',
    description: 'Database Examples',
    directory: 'database',
    service: 'database-examples'
  },
  {
    name: 'async-patterns',
    description: 'Async Patterns',
    directory: 'async-patterns',
    service: 'async-patterns'
  },
  {
    name: 'frameworks',
    description: 'Framework Examples',
    directory: 'frameworks',
    service: 'framework-examples'
  }
];

class ExampleTestRunner {
  private examplesDir: string;

  constructor(examplesDir: string = __dirname) {
    this.examplesDir = examplesDir;
  }

  async runAll(): Promise<Result<void, ZeroError>> {
    console.log('🚀 Running TypeScript checks on all ZeroThrow examples...');
    console.log('================================================');

    // First validate all examples
    const validationResult = await this.validateAllExamples();
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    // Run TypeScript type checking
    const testResults: TestResult[] = [];
    
    for (const example of EXAMPLES) {
      const result = await this.runTypeCheck(example);
      if (result.ok) {
        testResults.push(result.value);
      } else {
        testResults.push({
          example: example.name,
          passed: false,
          output: '',
          error: result.error.message
        });
      }
    }

    // Print summary
    this.printSummary(testResults);

    const failedTests = testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      return err(new ZeroError(
        'TYPECHECK_FAILED',
        `${failedTests.length} example(s) failed type checking`,
        { failedTests: failedTests.map(t => t.example) }
      ));
    }

    return ok(undefined);
  }

  private async validateAllExamples(): Promise<Result<ValidationResult[], ZeroError>> {
    console.log('🔍 Validating example configurations...');
    console.log('----------------------------------------');

    const results: ValidationResult[] = [];

    for (const example of EXAMPLES) {
      const result = await this.validateExample(example);
      if (result.ok) {
        results.push(result.value);
        if (result.value.passed) {
          console.log(`✅ ${example.description} validation passed`);
        } else {
          console.log(`❌ ${example.description} validation failed:`);
          result.value.issues.forEach(issue => console.log(`   - ${issue}`));
        }
      } else {
        console.log(`❌ ${example.description} validation error: ${result.error.message}`);
        results.push({
          example: example.name,
          passed: false,
          issues: [result.error.message]
        });
      }
    }

    const failedValidations = results.filter(r => !r.passed);
    if (failedValidations.length > 0) {
      return err(new ZeroError(
        'VALIDATION_FAILED',
        'Some examples failed validation',
        { failedValidations }
      ));
    }

    return ok(results);
  }

  private async validateExample(example: ExampleConfig): Promise<Result<ValidationResult, ZeroError>> {
    return tryR(() => {
      const examplePath = join(this.examplesDir, example.directory);
      const issues: string[] = [];

      // Check if directory exists
      if (!existsSync(examplePath)) {
        issues.push(`Directory ${example.directory} not found`);
        return { example: example.name, passed: false, issues };
      }

      // Check required files
      const requiredFiles = [
        'package.json',
        'vitest.config.ts',
        'tsconfig.json'
      ];

      for (const file of requiredFiles) {
        const filePath = join(examplePath, file);
        if (!existsSync(filePath)) {
          issues.push(`${file} not found`);
        }
      }

      // Check for test files
      let testFiles = false;
      try {
        const files = readdirSync(examplePath);
        testFiles = files.some((file: string) => file.includes('.test.'));
      } catch {
        // Directory read error
      }

      if (!testFiles) {
        issues.push('No test files found');
      }

      // Validate package.json
      try {
        const packageJsonPath = join(examplePath, 'package.json');
        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (!packageJson.scripts?.test) {
            issues.push('No test script in package.json');
          }
          if (!packageJson.devDependencies?.vitest) {
            issues.push('vitest not found in devDependencies');
          }
        }
      } catch {
        issues.push('Invalid package.json');
      }

      return {
        example: example.name,
        passed: issues.length === 0,
        issues
      };
    }, (error) => new ZeroError(
      'VALIDATION_ERROR',
      `Failed to validate ${example.name}`,
      { example: example.name, cause: error }
    ));
  }

  private async runTypeCheck(example: ExampleConfig): Promise<Result<TestResult, ZeroError>> {
    console.log(`\n🔍 Type checking ${example.description}...`);
    console.log('----------------------------------------');

    return tryR(() => {
      const examplePath = join(this.examplesDir, example.directory);
      
      // Run tsc --noEmit for type checking
      const output = execSync('npx tsc --noEmit', {
        cwd: examplePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      console.log(`✅ ${example.description} type check passed`);
      
      return {
        example: example.name,
        passed: true,
        output: output.toString() || 'No type errors found'
      };
    }, (error) => {
      console.log(`❌ ${example.description} type check failed`);
      
      const errorOutput = error instanceof Error && 'stdout' in error 
        ? (error as any).stdout?.toString() || error.message
        : String(error);

      return new ZeroError(
        'TYPECHECK_FAILED',
        `${example.description} type check failed`,
        { 
          example: example.name,
          output: errorOutput,
          cause: error 
        }
      );
    });
  }

  private printSummary(results: TestResult[]): void {
    console.log('\n================================================');
    console.log('📊 SUMMARY');
    console.log('================================================');

    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    if (failed.length === 0) {
      console.log('🎉 All examples passed successfully!');
      console.log('\nCompleted tests:');
      passed.forEach(result => {
        console.log(`   ✅ ${this.getExampleDescription(result.example)}`);
      });
    } else {
      console.log('❌ Some examples failed:');
      failed.forEach(result => {
        console.log(`   ❌ ${this.getExampleDescription(result.example)}`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
      
      if (passed.length > 0) {
        console.log('\n✅ Passed examples:');
        passed.forEach(result => {
          console.log(`   ✅ ${this.getExampleDescription(result.example)}`);
        });
      }
    }
  }

  private getExampleDescription(exampleName: string): string {
    const example = EXAMPLES.find(e => e.name === exampleName);
    return example?.description || exampleName;
  }

  async validateOnly(): Promise<Result<void, ZeroError>> {
    console.log('🔍 Validating ZeroThrow examples...');
    console.log('================================================');

    const validationResult = await this.validateAllExamples();
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    console.log('\n================================================');
    console.log('📊 VALIDATION SUMMARY');
    console.log('================================================');
    console.log('🎉 All examples validation passed!');
    console.log('\nExamples are ready for type checking:');
    console.log('  • React Examples: Complete with React component types');
    console.log('  • Node.js Examples: Express and Fastify API types');
    console.log('  • Database Examples: SQL integration types');
    console.log('  • Async Patterns: Comprehensive async pattern types');
    console.log('  • Framework Examples: Next.js and Remix pattern types');
    console.log('\nTo run type checking on examples:');
    console.log('  npm run test:examples');

    return ok(undefined);
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  const runner = new ExampleTestRunner();

  const result = command === 'validate' 
    ? await runner.validateOnly()
    : await runner.runAll();

  if (!result.ok) {
    console.error(`\n💥 ${result.error.message}`);
    if (result.error.context) {
      console.error('Context:', JSON.stringify(result.error.context, null, 2));
    }
    process.exit(1);
  }

  console.log('\n🎉 Done!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { ExampleTestRunner };