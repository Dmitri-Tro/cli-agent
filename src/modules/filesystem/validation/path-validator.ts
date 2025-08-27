import * as path from 'path';
import { DANGEROUS_PATH_PATTERNS } from '../constants';
import type { PathValidationResult, OperationResult } from '../types';

/**
 * Path Validator - responsible for validating filesystem paths
 * Ensures security and prevents path traversal attacks
 */
export class PathValidator {
  private readonly workingDirectory: string;

  constructor(workingDirectory?: string) {
    // Use workspace/ subdirectory for all file operations (security)
    this.workingDirectory = workingDirectory || path.join(process.cwd(), 'workspace');
  }

  /**
   * Validate that the path is safe and within working directory
   */
  validatePath(targetPath: string): PathValidationResult {
    try {
      // Resolve the path relative to working directory
      const resolvedPath = path.resolve(this.workingDirectory, targetPath);

      // Check if the resolved path is within working directory
      const relativePath = path.relative(this.workingDirectory, resolvedPath);

      // If relative path starts with '..' or is absolute, it's outside working directory
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          valid: false,
          error:
            'Путь находится вне рабочей директории. Разрешены только относительные пути в текущей директории.',
        };
      }

      // Check for dangerous patterns
      const hasDangerousPattern = DANGEROUS_PATH_PATTERNS.some(pattern =>
        pattern.test(resolvedPath)
      );
      if (hasDangerousPattern) {
        return {
          valid: false,
          error: 'Путь содержит опасные системные директории.',
        };
      }

      return { valid: true, resolvedPath };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid path: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Helper to handle path validation for operations - reduces code duplication
   */
  handlePathValidation(targetPath: string, operationName: string): OperationResult | null {
    const validation = this.validatePath(targetPath);
    if (!validation.valid) {
      return {
        success: false,
        message: `Не удалось выполнить операцию: ${operationName}`,
        error: validation.error || 'Unknown validation error',
      };
    }
    return null; // No error, continue with operation
  }

  /**
   * Helper to handle dual path validation for copy/move operations
   */
  handleDualPathValidation(
    sourcePath: string,
    destPath: string,
    operationName: string
  ): { error: OperationResult | null; sourceResolved?: string; destResolved?: string } {
    const sourceValidation = this.validatePath(sourcePath);
    const destValidation = this.validatePath(destPath);

    if (!sourceValidation.valid) {
      return {
        error: {
          success: false,
          message: `Неверный путь источника для операции: ${operationName}`,
          error: sourceValidation.error || 'Unknown validation error',
        },
      };
    }

    if (!destValidation.valid) {
      return {
        error: {
          success: false,
          message: `Неверный путь назначения для операции: ${operationName}`,
          error: destValidation.error || 'Unknown validation error',
        },
      };
    }

    return {
      error: null,
      sourceResolved: sourceValidation.resolvedPath!,
      destResolved: destValidation.resolvedPath!,
    };
  }

  /**
   * Get working directory
   */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }
}
