/**
 * Filesystem Module
 *
 * Provides unified interface for all filesystem operations including:
 * - File operations (create, read, write, delete, modify)
 * - Directory operations (create, delete, list)
 * - File manipulation (copy, move, rename)
 * - Path validation and security
 */

// Core filesystem operations
export { FileOperations } from './operations/file-operations';
export { DirectoryOperations } from './operations/directory-operations';
export { FileManipulationOperations } from './operations/file-manipulation-operations';

// Path validation
export { PathValidator } from './validation/path-validator';

// Unified facade
export { FilesystemService } from './filesystem.service';

// Types and interfaces
export type {
  CreateFileOptions,
  WriteFileMode,
  CreateDirectoryOptions,
  OperationResult,
  PathValidationResult,
  FileStats,
} from './types';

// Constants
export {
  MAX_FILE_SIZE_FOR_DISPLAY,
  DEFAULT_FILE_ENCODING,
  DANGEROUS_PATH_PATTERNS,
} from './constants';
