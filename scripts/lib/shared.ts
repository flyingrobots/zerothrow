import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ZT, ZeroThrow } from '../../packages/core/src/index';

const execAsync = promisify(exec);

// Execute shell command and return Result  
export async function execCmd(cmd: string): Promise<ZeroThrow.Result<string, ZeroThrow.ZeroError>> {
  try {
    const { stdout } = await execAsync(cmd);
    return ZT.ok(stdout.trim());
  } catch (e) {
    return ZT.err(ZeroThrow.wrap(e as Error, 'EXEC_FAILED', `Command failed: ${cmd}`));
  }
}

// Execute shell command with inherited stdio (for interactive commands)
export async function execCmdInteractive(cmd: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  return new Promise((resolve) => {
    exec(cmd, { stdio: 'inherit' } as any, (error) => {
      if (error) {
        resolve(ZT.err(ZeroThrow.wrap(error, 'EXEC_INTERACTIVE_FAILED', `Interactive command failed: ${cmd}`)));
      } else {
        resolve(ZT.ok(undefined));
      }
    });
  });
}

// Read JSON file
export async function readJsonFile<T = any>(filePath: string): Promise<ZeroThrow.Result<T, ZeroThrow.ZeroError>> {
  if (!existsSync(filePath)) {
    return ZT.err(new ZeroThrow.ZeroError('FILE_NOT_FOUND', `File not found: ${filePath}`));
  }
  
  return ZT.try(
    () => {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    },
    e => ZeroThrow.wrap(e as Error, 'JSON_PARSE_FAILED', `Failed to read JSON file: ${filePath}`)
  );
}

// Write JSON file
export async function writeJsonFile(filePath: string, data: any): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  return ZT.try(
    () => {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    },
    e => ZeroThrow.wrap(e as Error, 'FILE_WRITE_FAILED', `Failed to write JSON file: ${filePath}`)
  );
}

// Check if file exists
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// Read file as string
export async function readFile(path: string): Promise<ZeroThrow.Result<string, ZeroThrow.ZeroError>> {
  if (!existsSync(path)) {
    return ZT.err(new ZeroThrow.ZeroError('FILE_NOT_FOUND', `File not found: ${path}`));
  }
  
  return ZT.try(
    () => readFileSync(path, 'utf8'),
    e => ZeroThrow.wrap(e as Error, 'FILE_READ_FAILED', `Failed to read file: ${path}`)
  );
}

// Write file
export async function writeFile(path: string, content: string): Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>> {
  return ZT.try(
    () => writeFileSync(path, content),
    e => ZeroThrow.wrap(e as Error, 'FILE_WRITE_FAILED', `Failed to write file: ${path}`)
  );
}

// Combinable versions for fluent chaining
export const execCmdC = (cmd: string) => execCmd(cmd).then(r => r);
export const execCmdInteractiveC = (cmd: string) => execCmdInteractive(cmd).then(r => r);
export const readJsonFileC = <T = any>(filePath: string) => readJsonFile<T>(filePath).then(r => r);
export const writeJsonFileC = (filePath: string, data: any) => writeJsonFile(filePath, data).then(r => r);
export const readFileC = (path: string) => readFile(path).then(r => r);
export const writeFileC = (path: string, content: string) => writeFile(path, content).then(r => r);