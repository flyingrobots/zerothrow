/**
 * Example: File Processing with ZeroThrow
 * 
 * This example shows how to handle file operations, including reading,
 * parsing, transforming, and writing files with proper error handling.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Result, ok, err, tryR, wrap, ZeroError, andThen, map, collect } from '@zerothrow/zerothrow';

// Types
interface ProcessedFile {
  path: string;
  originalSize: number;
  processedSize: number;
  processingTime: number;
}

interface FileMetadata {
  path: string;
  size: number;
  modifiedTime: Date;
}

interface ProcessingOptions {
  inputDir: string;
  outputDir: string;
  fileExtension: string;
  transform: (content: string) => string;
}

// Error codes
const FileErrorCodes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  READ_ERROR: 'READ_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  DISK_FULL: 'DISK_FULL'
} as const;

// File operations
async function readFile(path: string): Promise<Result<string, ZeroError>> {
  return tryR(
    async () => {
      const content = await fs.readFile(path, 'utf-8');
      return content;
    },
    (error: any) => {
      if (error.code === 'ENOENT') {
        return new ZeroError(
          FileErrorCodes.FILE_NOT_FOUND,
          `File not found: ${path}`,
          error,
          { path }
        );
      }
      if (error.code === 'EACCES') {
        return new ZeroError(
          FileErrorCodes.PERMISSION_ERROR,
          `Permission denied: ${path}`,
          error,
          { path }
        );
      }
      return wrap(
        error,
        FileErrorCodes.READ_ERROR,
        `Failed to read file: ${path}`,
        { path }
      );
    }
  );
}

async function writeFile(
  path: string,
  content: string
): Promise<Result<void, ZeroError>> {
  return tryR(
    async () => {
      await fs.writeFile(path, content, 'utf-8');
    },
    (error: any) => {
      if (error.code === 'ENOSPC') {
        return new ZeroError(
          FileErrorCodes.DISK_FULL,
          'Disk full',
          error,
          { path }
        );
      }
      if (error.code === 'EACCES') {
        return new ZeroError(
          FileErrorCodes.PERMISSION_ERROR,
          `Permission denied: ${path}`,
          error,
          { path }
        );
      }
      return wrap(
        error,
        FileErrorCodes.WRITE_ERROR,
        `Failed to write file: ${path}`,
        { path }
      );
    }
  );
}

async function getFileMetadata(path: string): Promise<Result<FileMetadata, ZeroError>> {
  return tryR(
    async () => {
      const stats = await fs.stat(path);
      return {
        path,
        size: stats.size,
        modifiedTime: stats.mtime
      };
    },
    (error) => wrap(
      error,
      FileErrorCodes.READ_ERROR,
      `Failed to get file metadata: ${path}`,
      { path }
    )
  );
}

async function listFiles(
  dir: string,
  extension: string
): Promise<Result<string[], ZeroError>> {
  return tryR(
    async () => {
      const files = await fs.readdir(dir);
      return files
        .filter(file => file.endsWith(extension))
        .map(file => join(dir, file));
    },
    (error) => wrap(
      error,
      FileErrorCodes.READ_ERROR,
      `Failed to list files in: ${dir}`,
      { dir, extension }
    )
  );
}

async function ensureDirectory(dir: string): Promise<Result<void, ZeroError>> {
  return tryR(
    async () => {
      await fs.mkdir(dir, { recursive: true });
    },
    (error) => wrap(
      error,
      FileErrorCodes.WRITE_ERROR,
      `Failed to create directory: ${dir}`,
      { dir }
    )
  );
}

// JSON parsing with validation
interface JsonData {
  version: string;
  data: Record<string, any>;
}

function parseJson(content: string): Result<JsonData, ZeroError> {
  return tryR(
    () => {
      const parsed = JSON.parse(content);
      
      // Validate structure
      if (!parsed.version || typeof parsed.version !== 'string') {
        throw new Error('Missing or invalid version field');
      }
      
      if (!parsed.data || typeof parsed.data !== 'object') {
        throw new Error('Missing or invalid data field');
      }
      
      return parsed as JsonData;
    },
    (error) => wrap(
      error,
      FileErrorCodes.PARSE_ERROR,
      'Failed to parse JSON',
      { contentLength: content.length }
    )
  );
}

// CSV parsing
function parseCsv(content: string): Result<string[][], ZeroError> {
  try {
    const lines = content.trim().split('\n');
    const rows = lines.map(line => 
      line.split(',').map(cell => cell.trim())
    );
    
    if (rows.length === 0) {
      return err(new ZeroError(
        FileErrorCodes.INVALID_FORMAT,
        'CSV file is empty'
      ));
    }
    
    // Validate all rows have same number of columns
    const columnCount = rows[0].length;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].length !== columnCount) {
        return err(new ZeroError(
          FileErrorCodes.INVALID_FORMAT,
          `Row ${i + 1} has ${rows[i].length} columns, expected ${columnCount}`,
          undefined,
          { row: i + 1, expected: columnCount, actual: rows[i].length }
        ));
      }
    }
    
    return ok(rows);
  } catch (error) {
    return err(wrap(
      error,
      FileErrorCodes.PARSE_ERROR,
      'Failed to parse CSV'
    ));
  }
}

// File processor
class FileProcessor {
  async processFile(
    inputPath: string,
    outputPath: string,
    transform: (content: string) => string
  ): Promise<Result<ProcessedFile, ZeroError>> {
    const startTime = Date.now();
    
    // Read file
    const contentResult = await readFile(inputPath);
    if (contentResult.isErr) return contentResult;
    
    // Get original metadata
    const metadataResult = await getFileMetadata(inputPath);
    if (metadataResult.isErr) return metadataResult;
    
    // Transform content
    let transformed: string;
    try {
      transformed = transform(contentResult.value);
    } catch (error) {
      return err(wrap(
        error,
        FileErrorCodes.PARSE_ERROR,
        'Transformation failed',
        { inputPath }
      ));
    }
    
    // Write result
    const writeResult = await writeFile(outputPath, transformed);
    if (writeResult.isErr) return writeResult;
    
    // Return processing info
    return ok({
      path: outputPath,
      originalSize: metadataResult.value.size,
      processedSize: Buffer.byteLength(transformed, 'utf-8'),
      processingTime: Date.now() - startTime
    });
  }
  
  async processDirectory(options: ProcessingOptions): Promise<Result<ProcessedFile[], ZeroError>> {
    // Ensure output directory exists
    const dirResult = await ensureDirectory(options.outputDir);
    if (dirResult.isErr) return dirResult;
    
    // List files
    const filesResult = await listFiles(options.inputDir, options.fileExtension);
    if (filesResult.isErr) return filesResult;
    
    if (filesResult.value.length === 0) {
      return ok([]);
    }
    
    // Process each file
    const results = await Promise.all(
      filesResult.value.map(async (inputPath) => {
        const filename = inputPath.split('/').pop()!;
        const outputPath = join(options.outputDir, filename);
        
        return this.processFile(inputPath, outputPath, options.transform);
      })
    );
    
    // Collect results
    return collect(results);
  }
  
  async processJsonFiles(inputDir: string, outputDir: string): Promise<Result<ProcessedFile[], ZeroError>> {
    return this.processDirectory({
      inputDir,
      outputDir,
      fileExtension: '.json',
      transform: (content) => {
        const parseResult = parseJson(content);
        if (parseResult.isErr) throw parseResult.error;
        
        // Example transformation: Add timestamp
        const transformed = {
          ...parseResult.value,
          processedAt: new Date().toISOString()
        };
        
        return JSON.stringify(transformed, null, 2);
      }
    });
  }
  
  async processCsvFiles(inputDir: string, outputDir: string): Promise<Result<ProcessedFile[], ZeroError>> {
    return this.processDirectory({
      inputDir,
      outputDir,
      fileExtension: '.csv',
      transform: (content) => {
        const parseResult = parseCsv(content);
        if (parseResult.isErr) throw parseResult.error;
        
        const rows = parseResult.value;
        
        // Example transformation: Add row numbers
        const transformed = rows.map((row, index) => 
          [index.toString(), ...row]
        );
        
        return transformed.map(row => row.join(',')).join('\n');
      }
    });
  }
}

// Batch processing with progress
class BatchFileProcessor {
  private processor = new FileProcessor();
  
  async processBatch(
    files: string[],
    outputDir: string,
    transform: (content: string) => string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Result<ProcessedFile[], ZeroError[]>> {
    const results: ProcessedFile[] = [];
    const errors: ZeroError[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const inputPath = files[i];
      const filename = inputPath.split('/').pop()!;
      const outputPath = join(outputDir, `processed_${filename}`);
      
      const result = await this.processor.processFile(
        inputPath,
        outputPath,
        transform
      );
      
      if (result.isOk) {
        results.push(result.value);
      } else {
        errors.push(result.error);
      }
      
      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    }
    
    if (errors.length > 0) {
      return err(errors);
    }
    
    return ok(results);
  }
}

// Usage examples
async function example() {
  const processor = new FileProcessor();
  
  // Process single file
  const result1 = await processor.processFile(
    './input.txt',
    './output.txt',
    (content) => content.toUpperCase()
  );
  
  if (result1.isOk) {
    console.log(`Processed ${result1.value.originalSize} bytes in ${result1.value.processingTime}ms`);
  } else {
    console.error(`Error: ${result1.error.message}`);
  }
  
  // Process directory
  const result2 = await processor.processJsonFiles('./data', './processed');
  
  if (result2.isOk) {
    console.log(`Processed ${result2.value.length} files`);
    result2.value.forEach(file => {
      console.log(`- ${file.path}: ${file.originalSize} → ${file.processedSize} bytes`);
    });
  } else {
    console.error(`Error: ${result2.error.message}`);
  }
  
  // Batch processing with progress
  const batchProcessor = new BatchFileProcessor();
  const files = ['file1.txt', 'file2.txt', 'file3.txt'];
  
  const result3 = await batchProcessor.processBatch(
    files,
    './output',
    (content) => content.replace(/\r\n/g, '\n'),
    (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    }
  );
  
  if (result3.isOk) {
    console.log('Batch processing completed successfully');
  } else {
    console.error(`${result3.error.length} files failed to process`);
    result3.error.forEach(error => {
      console.error(`- ${error.context?.path}: ${error.message}`);
    });
  }
}

export { FileProcessor, BatchFileProcessor, parseJson, parseCsv };