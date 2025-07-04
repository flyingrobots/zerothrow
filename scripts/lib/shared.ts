import { exec, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ZT, ZeroThrow } from '../../packages/core/src/index';

// Execute shell command and stream output (returns exit code, not stdout)
export function execCmdStream(
  cmd: string, 
  onStdout?: (chunk: string) => void,
  onStderr?: (chunk: string) => void,
  verbose?: boolean
): ZeroThrow.Async<number, ZeroThrow.ZeroError> {
  return ZeroThrow.fromAsync(() =>
    new Promise<ZeroThrow.Result<number, ZeroThrow.ZeroError>>((resolve) => {
      if (verbose) {
        console.log(`[execCmdStream] Running: ${cmd}`);
      }
      
      const proc = spawn(cmd, [], { shell: true });
      
      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        onStdout?.(chunk);
        if (verbose && !onStdout) {
          process.stdout.write(chunk);
        }
      });
      
      proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        onStderr?.(chunk);
        if (verbose && !onStderr) {
          process.stderr.write(chunk);
        }
      });
      
      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(ZT.err(new ZeroThrow.ZeroError(
            'EXEC_FAILED', 
            `Command failed with exit code ${code}: ${cmd}`,
            { context: { code } }
          )));
        } else {
          resolve(ZT.ok(code || 0));
        }
      });
      
      proc.on('error', (error) => {
        resolve(ZT.err(ZeroThrow.wrap(error, 'EXEC_FAILED', `Command failed to start: ${cmd}`)));
      });
    })
  );
}

// Execute shell command and return output (stores in memory)
export function execCmd(cmd: string, verbose?: boolean): ZeroThrow.Async<string, ZeroThrow.ZeroError> {
  return ZeroThrow.fromAsync(() =>
    new Promise<ZeroThrow.Result<string, ZeroThrow.ZeroError>>((resolve) => {
      if (verbose) {
        console.log(`[execCmd] Running: ${cmd}`);
      }
      
      exec(cmd, (error, stdout, stderr) => {
        if (verbose && stdout) {
          console.log(stdout);
        }
        if (verbose && stderr) {
          console.error(stderr);
        }
        
        if (error) {
          resolve(ZT.err(new ZeroThrow.ZeroError(
            'EXEC_FAILED',
            `Command failed: ${cmd}`,
            { context: { code: error.code, stderr: stderr.trim() } }
          )));
        } else {
          resolve(ZT.ok(stdout.trim()));
        }
      });
    })
  );
}

// Execute shell command with inherited stdio (for interactive commands)
export function execCmdInteractive(cmd: string): ZeroThrow.Async<void, ZeroThrow.ZeroError> {
  return ZeroThrow.fromAsync(() => 
    new Promise<ZeroThrow.Result<void, ZeroThrow.ZeroError>>((resolve) => {
      exec(cmd, { stdio: 'inherit' } as any, (error) => {
        if (error) {
          resolve(ZT.err(ZeroThrow.wrap(error, 'EXEC_INTERACTIVE_FAILED', `Interactive command failed: ${cmd}`)));
        } else {
          resolve(ZT.ok(undefined));
        }
      });
    })
  );
}

// Read JSON file
export function readJsonFile<T = any>(filePath: string): ZeroThrow.Async<T, ZeroThrow.ZeroError> {
  return ZeroThrow.enhance(
    Promise.resolve(
      existsSync(filePath) 
        ? ZT.ok(filePath)
        : ZT.err(new ZeroThrow.ZeroError('FILE_NOT_FOUND', `File not found: ${filePath}`))
    )
  ).andThen(() => 
    ZT.try(
      () => {
        const content = readFileSync(filePath, 'utf8');
        return JSON.parse(content) as T;
      },
      e => ZeroThrow.wrap(e as Error, 'JSON_PARSE_FAILED', `Failed to read JSON file: ${filePath}`)
    )
  );
}

// Write JSON file
export function writeJsonFile(filePath: string, data: any): ZeroThrow.Async<void, ZeroThrow.ZeroError> {
  return ZeroThrow.enhance(
    Promise.resolve(ZT.ok(data))
  ).andThen(() =>
    ZT.try(
      () => {
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      },
      e => ZeroThrow.wrap(e as Error, 'FILE_WRITE_FAILED', `Failed to write JSON file: ${filePath}`)
    )
  );
}

// Check if file exists
export function fileExists(path: string): boolean {
  return existsSync(path);
}

// Read file as string
export function readFile(path: string): ZeroThrow.Async<string, ZeroThrow.ZeroError> {
  return ZeroThrow.enhance(
    Promise.resolve(
      existsSync(path)
        ? ZT.ok(path)
        : ZT.err(new ZeroThrow.ZeroError('FILE_NOT_FOUND', `File not found: ${path}`))
    )
  ).andThen(() =>
    ZT.try(
      () => readFileSync(path, 'utf8'),
      e => ZeroThrow.wrap(e as Error, 'FILE_READ_FAILED', `Failed to read file: ${path}`)
    )
  );
}

// Write file
export function writeFile(path: string, content: string): ZeroThrow.Async<void, ZeroThrow.ZeroError> {
  return ZeroThrow.enhance(
    Promise.resolve(ZT.ok(content))
  ).andThen(() =>
    ZT.try(
      () => writeFileSync(path, content),
      e => ZeroThrow.wrap(e as Error, 'FILE_WRITE_FAILED', `Failed to write file: ${path}`)
    )
  );
}

// The functions above already return ZeroThrow.Async which has all combinator methods
// No need for separate enhanced versions!