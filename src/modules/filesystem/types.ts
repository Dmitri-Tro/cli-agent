/**
 * Filesystem module types and interfaces
 */

/**
 * Options for file creation
 */
export interface CreateFileOptions {
  overwrite?: boolean;
}

/**
 * File write modes
 */
export type WriteFileMode = 'overwrite' | 'append';

/**
 * Options for directory creation
 */
export interface CreateDirectoryOptions {
  recursive?: boolean;
}

/**
 * Result of filesystem operation
 */
export interface OperationResult {
  success: boolean;
  message: string;
  path?: string;
  error?: string;
}

/**
 * Path validation result interface
 */
export interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * File statistics interface
 */
export interface FileStats {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modified: Date;
  created: Date;
}
