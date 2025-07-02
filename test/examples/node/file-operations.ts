import * as fs from 'fs/promises';
import * as path from 'path';
import { Result, ok, err, ZeroError, tryR, wrap } from '@flyingrobots/zerothrow';

// File operations with ZeroThrow error handling

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: Date;
}

// Safe file reading with Result
export async function readFile(filePath: string): Promise<Result<string, ZeroError>> {
  return tryR(
    async () => {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    },
    (error) => new ZeroError(
      'FILE_READ_ERROR',
      `Failed to read file: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// Safe file writing
export async function writeFile(
  filePath: string, 
  content: string
): Promise<Result<void, ZeroError>> {
  return tryR(
    async () => {
      await fs.writeFile(filePath, content, 'utf-8');
    },
    (error) => new ZeroError(
      'FILE_WRITE_ERROR',
      `Failed to write file: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// Safe file deletion
export async function deleteFile(filePath: string): Promise<Result<void, ZeroError>> {
  // Check if file exists first
  const existsResult = await fileExists(filePath);
  if (!existsResult.ok) {
    return err(existsResult.error);
  }
  
  if (!existsResult.value) {
    return err(new ZeroError(
      'FILE_NOT_FOUND',
      `File does not exist: ${filePath}`,
      { filePath }
    ));
  }

  return tryR(
    async () => {
      await fs.unlink(filePath);
    },
    (error) => new ZeroError(
      'FILE_DELETE_ERROR',
      `Failed to delete file: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// Check if file exists
export async function fileExists(filePath: string): Promise<Result<boolean, ZeroError>> {
  return tryR(
    async () => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    (error) => new ZeroError(
      'FILE_ACCESS_ERROR',
      `Failed to check file existence: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// Get file info
export async function getFileInfo(filePath: string): Promise<Result<FileInfo, ZeroError>> {
  return tryR(
    async () => {
      const stats = await fs.stat(filePath);
      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modifiedAt: stats.mtime
      };
    },
    (error) => new ZeroError(
      'FILE_STAT_ERROR',
      `Failed to get file info: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// List directory contents
export async function listDirectory(dirPath: string): Promise<Result<FileInfo[], ZeroError>> {
  return tryR(
    async () => {
      const entries = await fs.readdir(dirPath);
      const fileInfos: FileInfo[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const infoResult = await getFileInfo(fullPath);
        
        if (infoResult.ok) {
          fileInfos.push(infoResult.value);
        }
        // Skip files we can't stat (e.g., broken symlinks)
      }

      return fileInfos;
    },
    (error) => new ZeroError(
      'DIR_READ_ERROR',
      `Failed to list directory: ${dirPath}`,
      { dirPath, cause: error }
    )
  );
}

// Create directory with parents
export async function createDirectory(dirPath: string): Promise<Result<void, ZeroError>> {
  return tryR(
    async () => {
      await fs.mkdir(dirPath, { recursive: true });
    },
    (error) => new ZeroError(
      'DIR_CREATE_ERROR',
      `Failed to create directory: ${dirPath}`,
      { dirPath, cause: error }
    )
  );
}

// Copy file
export async function copyFile(
  source: string,
  destination: string
): Promise<Result<void, ZeroError>> {
  // Check if source exists
  const sourceExistsResult = await fileExists(source);
  if (!sourceExistsResult.ok) {
    return err(sourceExistsResult.error);
  }
  
  if (!sourceExistsResult.value) {
    return err(new ZeroError(
      'SOURCE_NOT_FOUND',
      `Source file does not exist: ${source}`,
      { source }
    ));
  }

  return tryR(
    async () => {
      await fs.copyFile(source, destination);
    },
    (error) => new ZeroError(
      'FILE_COPY_ERROR',
      `Failed to copy file from ${source} to ${destination}`,
      { source, destination, cause: error }
    )
  );
}

// JSON file operations
export async function readJsonFile<T>(filePath: string): Promise<Result<T, ZeroError>> {
  const contentResult = await readFile(filePath);
  if (!contentResult.ok) {
    return err(contentResult.error);
  }

  return tryR(
    () => JSON.parse(contentResult.value) as T,
    (error) => new ZeroError(
      'JSON_PARSE_ERROR',
      `Failed to parse JSON from file: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

export async function writeJsonFile<T>(
  filePath: string,
  data: T,
  pretty = true
): Promise<Result<void, ZeroError>> {
  return tryR(
    async () => {
      const content = pretty 
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);
      
      const result = await writeFile(filePath, content);
      if (!result.ok) {
        throw result.error;
      }
    },
    (error) => new ZeroError(
      'JSON_WRITE_ERROR',
      `Failed to write JSON to file: ${filePath}`,
      { filePath, cause: error }
    )
  );
}

// Batch file operations
export async function processFiles<T>(
  filePaths: string[],
  processor: (filePath: string) => Promise<Result<T, ZeroError>>
): Promise<Result<T[], ZeroError>> {
  const results: T[] = [];
  const errors: ZeroError[] = [];

  for (const filePath of filePaths) {
    const result = await processor(filePath);
    if (result.ok) {
      results.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return err(new ZeroError(
      'BATCH_PROCESS_ERROR',
      `Failed to process ${errors.length} out of ${filePaths.length} files`,
      { 
        totalFiles: filePaths.length,
        failedCount: errors.length,
        errors: errors.map(e => ({
          code: e.code,
          message: e.message,
          context: e.context
        }))
      }
    ));
  }

  return ok(results);
}

// File watcher with Result-based event handling
export function createFileWatcher(
  filePath: string,
  onChange: (event: string) => Promise<Result<void, ZeroError>>
) {
  const watcher = fs.watch(filePath);
  
  watcher.on('change', async (eventType) => {
    const result = await onChange(eventType);
    if (!result.ok) {
      console.error('Watcher error:', result.error);
    }
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', new ZeroError(
      'WATCHER_ERROR',
      'File watcher encountered an error',
      { filePath, cause: error }
    ));
  });

  return {
    close: () => watcher.close()
  };
}

// Example usage
export async function example() {
  // Read file
  const contentResult = await readFile('./example.txt');
  if (!contentResult.ok) {
    console.error('Failed to read file:', contentResult.error.message);
    return;
  }
  console.log('File content:', contentResult.value);

  // Write JSON file
  const data = { name: 'John', age: 30 };
  const writeResult = await writeJsonFile('./data.json', data);
  if (!writeResult.ok) {
    console.error('Failed to write JSON:', writeResult.error.message);
    return;
  }

  // List directory
  const filesResult = await listDirectory('./');
  if (filesResult.ok) {
    console.log('Files:', filesResult.value.map(f => f.name));
  }

  // Batch process files
  const processResult = await processFiles(
    ['file1.txt', 'file2.txt', 'file3.txt'],
    async (filePath) => {
      const result = await readFile(filePath);
      if (!result.ok) return result;
      
      // Process content
      const processed = result.value.toUpperCase();
      return ok(processed);
    }
  );

  if (processResult.ok) {
    console.log('Processed files:', processResult.value.length);
  } else {
    console.error('Batch processing failed:', processResult.error);
  }
}