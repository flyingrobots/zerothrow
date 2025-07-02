import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Result, ok, err, tryR, wrap, ZeroError, makeCombinable } from '../../src/index';

const execAsync = promisify(exec);

// Execute shell command and return Result  
export async function execCmd(cmd: string): Promise<Result<string, ZeroError>> {
  return tryR(
    async () => {
      const { stdout } = await execAsync(cmd);
      return stdout.trim();
    },
    e => wrap(e, 'EXEC_FAILED', `Command failed: ${cmd}`)
  );
}

// Execute shell command with inherited stdio (for interactive commands)
export async function execCmdInteractive(cmd: string): Promise<Result<void, ZeroError>> {
  return tryR(
    () => new Promise<void>((resolve, reject) => {
      exec(cmd, { stdio: 'inherit' }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
    e => wrap(e, 'EXEC_INTERACTIVE_FAILED', `Interactive command failed: ${cmd}`)
  );
}

// Read JSON file
export async function readJsonFile<T = any>(filePath: string): Promise<Result<T, ZeroError>> {
  if (!existsSync(filePath)) {
    return err(new ZeroError('FILE_NOT_FOUND', `File not found: ${filePath}`));
  }
  
  return tryR(
    () => {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    },
    e => wrap(e, 'JSON_PARSE_FAILED', `Failed to read JSON file: ${filePath}`)
  );
}

// Write JSON file
export async function writeJsonFile(filePath: string, data: any): Promise<Result<void, ZeroError>> {
  return tryR(
    () => {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    },
    e => wrap(e, 'FILE_WRITE_FAILED', `Failed to write JSON file: ${filePath}`)
  );
}

// Check if file exists
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// Read file as string
export async function readFile(path: string): Promise<Result<string, ZeroError>> {
  if (!existsSync(path)) {
    return err(new ZeroError('FILE_NOT_FOUND', `File not found: ${path}`));
  }
  
  return tryR(
    () => readFileSync(path, 'utf8'),
    e => wrap(e, 'FILE_READ_FAILED', `Failed to read file: ${path}`)
  );
}

// Write file
export async function writeFile(path: string, content: string): Promise<Result<void, ZeroError>> {
  return tryR(
    () => writeFileSync(path, content),
    e => wrap(e, 'FILE_WRITE_FAILED', `Failed to write file: ${path}`)
  );
}

// Combinable versions for fluent chaining
export const execCmdC = (cmd: string) => execCmd(cmd).then(makeCombinable);
export const execCmdInteractiveC = (cmd: string) => execCmdInteractive(cmd).then(makeCombinable);
export const readJsonFileC = <T = any>(filePath: string) => readJsonFile<T>(filePath).then(makeCombinable);
export const writeJsonFileC = (filePath: string, data: any) => writeJsonFile(filePath, data).then(makeCombinable);
export const readFileC = (path: string) => readFile(path).then(makeCombinable);
export const writeFileC = (path: string, content: string) => writeFile(path, content).then(makeCombinable);