import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ZT } from '../../src/index';

const execAsync = promisify(exec);

// Execute shell command and return Result  
export async function execCmd(cmd: string): Promise<ZT.Result<string, ZT.ZeroError>> {
  return ZT.tryR(
    async () => {
      const { stdout } = await execAsync(cmd);
      return stdout.trim();
    },
    e => ZT.wrap(e, 'EXEC_FAILED', `Command failed: ${cmd}`)
  );
}

// Execute shell command with inherited stdio (for interactive commands)
export async function execCmdInteractive(cmd: string): Promise<ZT.Result<void, ZT.ZeroError>> {
  return ZT.tryR(
    () => new Promise<void>((resolve, reject) => {
      exec(cmd, { stdio: 'inherit' }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
    e => ZT.wrap(e, 'EXEC_INTERACTIVE_FAILED', `Interactive command failed: ${cmd}`)
  );
}

// Read JSON file
export async function readJsonFile<T = any>(filePath: string): Promise<ZT.Result<T, ZT.ZeroError>> {
  if (!existsSync(filePath)) {
    return ZT.err(new ZT.ZeroError('FILE_NOT_FOUND', `File not found: ${filePath}`));
  }
  
  return ZT.tryR(
    () => {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    },
    e => ZT.wrap(e, 'JSON_PARSE_FAILED', `Failed to read JSON file: ${filePath}`)
  );
}

// Write JSON file
export async function writeJsonFile(filePath: string, data: any): Promise<ZT.Result<void, ZT.ZeroError>> {
  return ZT.tryR(
    () => {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    },
    e => ZT.wrap(e, 'FILE_WRITE_FAILED', `Failed to write JSON file: ${filePath}`)
  );
}

// Check if file exists
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// Read file as string
export async function readFile(path: string): Promise<ZT.Result<string, ZT.ZeroError>> {
  if (!existsSync(path)) {
    return ZT.err(new ZT.ZeroError('FILE_NOT_FOUND', `File not found: ${path}`));
  }
  
  return ZT.tryR(
    () => readFileSync(path, 'utf8'),
    e => ZT.wrap(e, 'FILE_READ_FAILED', `Failed to read file: ${path}`)
  );
}

// Write file
export async function writeFile(path: string, content: string): Promise<ZT.Result<void, ZT.ZeroError>> {
  return ZT.tryR(
    () => writeFileSync(path, content),
    e => ZT.wrap(e, 'FILE_WRITE_FAILED', `Failed to write file: ${path}`)
  );
}

// Combinable versions for fluent chaining
export const execCmdC = (cmd: string) => execCmd(cmd).then(ZT.makeCombinable);
export const execCmdInteractiveC = (cmd: string) => execCmdInteractive(cmd).then(ZT.makeCombinable);
export const readJsonFileC = <T = any>(filePath: string) => readJsonFile<T>(filePath).then(ZT.makeCombinable);
export const writeJsonFileC = (filePath: string, data: any) => writeJsonFile(filePath, data).then(ZT.makeCombinable);
export const readFileC = (path: string) => readFile(path).then(ZT.makeCombinable);
export const writeFileC = (path: string, content: string) => writeFile(path, content).then(ZT.makeCombinable);