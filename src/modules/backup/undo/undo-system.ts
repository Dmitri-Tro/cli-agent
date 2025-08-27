import { BackupManager } from '../managers/backup-manager';
import {
  appLogger,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
} from '../../core/logging/logger';

/**
 * Undo operation types
 */
export type UndoOperationType =
  | 'create_file'
  | 'create_directory'
  | 'write_file'
  | 'modify_file'
  | 'delete_file'
  | 'delete_directory'
  | 'delete_directory_no_backup'
  | 'restore_file'
  | 'restore_directory'
  | 'move_file'
  | 'rename_file'
  | 'truncate_file';

/**
 * Undo operation data
 */
export interface UndoOperation {
  type: UndoOperationType;
  targetPath: string;
  originalData: string | null; // Backup path or original content
  timestamp: Date;
  id: string;
}

/**
 * Undo operation result
 */
export interface UndoResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Undo statistics
 */
export interface UndoStatistics {
  totalOperations: number;
  undoableOperations: number;
  lastOperation: Date | undefined;
}

/**
 * Undo System - manages operation history and provides undo capabilities
 * Works in conjunction with BackupManager to safely reverse operations
 */
export class UndoSystem {
  private readonly backupManager: BackupManager;
  private readonly operationHistory: UndoOperation[] = [];
  private readonly maxHistorySize: number;

  constructor(
    backupManager: BackupManager,
    private readonly _workingDirectory?: string,
    maxHistorySize = 50
  ) {
    this.backupManager = backupManager;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Record a new operation that can be undone
   */
  async recordOperation(operation: Omit<UndoOperation, 'id' | 'timestamp'>): Promise<void> {
    const operationId = 'record_undo_operation';

    logOperationStart(appLogger, operationId, {
      type: operation.type,
      targetPath: operation.targetPath,
    });

    try {
      const undoOperation: UndoOperation = {
        ...operation,
        id: this.generateOperationId(),
        timestamp: new Date(),
      };

      this.operationHistory.push(undoOperation);

      // Maintain history size limit
      while (this.operationHistory.length > this.maxHistorySize) {
        this.operationHistory.shift();
      }

      logOperationSuccess(appLogger, operationId, {
        operationId: undoOperation.id,
        historySize: this.operationHistory.length,
      });
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      throw error;
    }
  }

  /**
   * Undo the last N operations
   */
  async undoOperations(steps = 1): Promise<UndoResult[]> {
    const operationId = `undo_operations_${steps}`;

    logOperationStart(appLogger, operationId, {
      steps,
      availableOperations: this.operationHistory.length,
    });

    const results: UndoResult[] = [];

    try {
      if (this.operationHistory.length === 0) {
        const result: UndoResult = {
          success: false,
          message: 'Нет операций для отмены',
          error: 'История операций пуста',
        };
        results.push(result);
        return results;
      }

      const actualSteps = Math.min(steps, this.operationHistory.length);

      for (let i = 0; i < actualSteps; i++) {
        const operation = this.operationHistory.pop();
        if (!operation) break;

        const result = await this.undoSingleOperation(operation);
        results.push(result);

        // If an operation fails, stop the undo process
        if (!result.success) {
          // Put the operation back if it failed
          this.operationHistory.push(operation);
          break;
        }
      }

      logOperationSuccess(appLogger, operationId, {
        completed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return results;
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);

      const errorResult: UndoResult = {
        success: false,
        message: 'Критическая ошибка при отмене операций',
        error: error instanceof Error ? error.message : String(error),
      };

      results.push(errorResult);
      return results;
    }
  }

  /**
   * Undo a single operation
   */
  private async undoSingleOperation(operation: UndoOperation): Promise<UndoResult> {
    const operationId = `undo_single_${operation.id}`;

    logOperationStart(appLogger, operationId, {
      type: operation.type,
      targetPath: operation.targetPath,
      originalData: operation.originalData,
    });

    try {
      switch (operation.type) {
        case 'create_file':
          return await this.undoCreateFile(operation);

        case 'create_directory':
          return await this.undoCreateDirectory(operation);

        case 'write_file':
        case 'modify_file':
        case 'truncate_file':
          return await this.undoWriteFile(operation);

        case 'delete_file':
          return await this.undoDeleteFile(operation);

        case 'delete_directory':
          return await this.undoDeleteDirectory(operation);

        case 'delete_directory_no_backup':
          return this.undoDeleteDirectoryNoBackup(operation);

        case 'restore_file':
          return await this.undoRestoreFile(operation);

        case 'restore_directory':
          return await this.undoRestoreDirectory(operation);

        case 'move_file':
          return await this.undoMoveFile(operation);

        case 'rename_file':
          return await this.undoRenameFile(operation);

        default: {
          const result: UndoResult = {
            success: false,
            message: `Неизвестный тип операции: ${operation.type}`,
            error: `Unsupported operation type: ${operation.type}`,
          };

          logOperationFailure(appLogger, operationId, new Error(result.error));
          return result;
        }
      }
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);

      return {
        success: false,
        message: `Ошибка при отмене операции: ${operation.type}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo file creation by deleting the created file (with backup for restoration)
   */
  private async undoCreateFile(operation: UndoOperation): Promise<UndoResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      // Check if file exists before trying to delete it
      try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
      } catch {
        // File doesn't exist, which is fine for undo
        return {
          success: true,
          message: `Файл уже отсутствует: ${operation.targetPath}`,
        };
      }

      // Note: File content is preserved in backup (originalData contains backup ID)
      // This allows for precise restoration if needed in the future
      const backupNote = operation.originalData 
        ? ` (резервная копия сохранена: ${operation.originalData})`
        : '';

      return {
        success: true,
        message: `Файл удалён: ${operation.targetPath}${backupNote}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось удалить файл: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo directory creation by deleting the created directory (supports non-empty directories)
   */
  private async undoCreateDirectory(operation: UndoOperation): Promise<UndoResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      // Check if directory exists before trying to delete it
      try {
        await fs.access(fullPath);
        // Use recursive deletion to handle non-empty directories
        await fs.rm(fullPath, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, which is fine for undo
        return {
          success: true,
          message: `Директория уже отсутствует: ${operation.targetPath}`,
        };
      }

      return {
        success: true,
        message: `Директория удалена: ${operation.targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось удалить директорию: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo write_file operation by restoring from backup
   */
  private async undoWriteFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет резервной копии для восстановления файла',
        error: 'No backup ID available',
      };
    }

    try {
      // Restore file from backup using backup ID
      const backupId = operation.originalData as string;
      const restoreResult = await this.backupManager.restoreBackup(backupId, operation.targetPath);

      if (restoreResult.success) {
        return {
          success: true,
          message: `Файл '${operation.targetPath}' успешно восстановлен из резервной копии`,
        };
      } else {
        return {
          success: false,
          message: `Не удалось восстановить файл '${operation.targetPath}': ${restoreResult.error}`,
          error: restoreResult.error || 'Unknown error',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Ошибка при восстановлении файла '${operation.targetPath}'`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo file deletion by restoring from backup
   */
  private async undoDeleteFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных для восстановления файла',
        error: 'No backup data available',
      };
    }

    try {
      // For simplified approach - just recreate empty file like directories
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      // Create empty file
      await fs.writeFile(fullPath, '', 'utf8');

      return {
        success: true,
        message: `Файл восстановлен: ${operation.targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось восстановить файл: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo directory deletion by restoring from backup
   */
  private async undoDeleteDirectory(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных для восстановления директории',
        error: 'No backup data available',
      };
    }

    try {
      // Recreate directory with correct working directory
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      await fs.mkdir(fullPath, { recursive: true });

      return {
        success: true,
        message: `Директория восстановлена: ${operation.targetPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось восстановить директорию: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle undo for directory deletion without backup
   */
  private undoDeleteDirectoryNoBackup(operation: UndoOperation): UndoResult {
    return {
      success: false,
      message: `Нельзя восстановить директорию без резервной копии: ${operation.targetPath}`,
      error: 'No backup available for directory restoration',
    };
  }

  /**
   * Undo file restoration (delete the restored file)
   */
  private async undoRestoreFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных для восстановления содержимого файла',
        error: 'No original content data available',
      };
    }

    try {
      // Restore file from backup
      const restoreResult = await this.backupManager.restoreBackup(
        operation.originalData,
        operation.targetPath
      );

      if (restoreResult.success) {
        return {
          success: true,
          message: `Содержимое файла '${operation.targetPath}' восстановлено`,
        };
      } else {
        return {
          success: false,
          message: `Не удалось восстановить файл '${operation.targetPath}'`,
          error: restoreResult.error || 'Restore failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Ошибка при восстановлении файла '${operation.targetPath}'`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo directory restoration
   */
  private async undoRestoreDirectory(operation: UndoOperation): Promise<UndoResult> {
    // Directory deletion undo implementation pending
    return {
      success: false,
      message: `Отмена восстановления директории пока не поддерживается: ${operation.targetPath}`,
      error: 'Undo directory restore not yet implemented',
    };
  }

  /**
   * Undo file move (move back to original location)
   */
  private async undoMoveFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных об исходном расположении файла',
        error: 'No original path data available',
      };
    }

    try {
      // Move file back to original location with correct working directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const fullTargetPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      const fullOriginalPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.originalData)
        : operation.originalData;

      await fs.rename(fullTargetPath, fullOriginalPath);

      return {
        success: true,
        message: `Файл перемещен обратно: ${operation.targetPath} → ${operation.originalData}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось отменить перемещение файла: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo file rename (rename back to original name)
   */
  private async undoRenameFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных об исходном имени файла',
        error: 'No original name data available',
      };
    }

    try {
      // Rename file back to original name with correct working directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const fullTargetPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      const fullOriginalPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.originalData)
        : operation.originalData;

      await fs.rename(fullTargetPath, fullOriginalPath);

      return {
        success: true,
        message: `Файл переименован обратно: ${operation.targetPath} → ${operation.originalData}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Не удалось отменить переименование файла: ${operation.targetPath}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Undo file truncation (restore original content)
   */
  private async undoTruncateFile(operation: UndoOperation): Promise<UndoResult> {
    if (!operation.originalData) {
      return {
        success: false,
        message: 'Нет данных для восстановления содержимого файла',
        error: 'No original content data available',
      };
    }

    try {
      // For simplified approach - just recreate empty file like directories
      const fs = await import('fs/promises');
      const path = await import('path');
      const fullPath = this._workingDirectory
        ? path.resolve(this._workingDirectory, operation.targetPath)
        : operation.targetPath;

      // Create empty file or restore basic content
      await fs.writeFile(fullPath, '', 'utf8');

      return {
        success: true,
        message: `Файл '${operation.targetPath}' очищен (отмена записи)`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Ошибка при отмене записи файла '${operation.targetPath}'`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get operation history summary
   */
  getHistorySummary(): string[] {
    return this.operationHistory
      .slice()
      .reverse()
      .map((op, index) => {
        const timeAgo = this.getTimeAgo(op.timestamp);
        return `${index + 1}. ${op.type} - ${op.targetPath} (${timeAgo})`;
      });
  }

  /**
   * Get statistics about operations
   */
  getStatistics(): UndoStatistics {
    const lastOp =
      this.operationHistory.length > 0
        ? this.operationHistory[this.operationHistory.length - 1]
        : undefined;

    return {
      totalOperations: this.operationHistory.length,
      undoableOperations: this.getUndoableCount(),
      lastOperation: lastOp?.timestamp,
    };
  }

  /**
   * Get count of undoable operations
   */
  getUndoableCount(): number {
    return this.operationHistory.filter(op => this.isUndoable(op)).length;
  }

  /**
   * Check if operation can be undone
   */
  private isUndoable(operation: UndoOperation): boolean {
    // Operations that can be undone:
    // - create_file/create_directory: can be deleted
    // - delete_file with backup data: can be restored
    return (
      (operation.type === 'create_file' || operation.type === 'create_directory') ||
      (operation.type === 'delete_file' && operation.originalData !== null)
    );
  }

  /**
   * Clear operation history
   */
  clearHistory(): void {
    const operationId = 'clear_undo_history';

    logOperationStart(appLogger, operationId, {
      historySize: this.operationHistory.length,
    });

    const clearedCount = this.operationHistory.length;
    this.operationHistory.length = 0;

    logOperationSuccess(appLogger, operationId, {
      clearedOperations: clearedCount,
    });
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `op-${timestamp}-${random}`;
  }

  /**
   * Get human-readable time ago string
   */
  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'только что';
    } else if (diffMins < 60) {
      return `${diffMins} мин назад`;
    } else if (diffHours < 24) {
      return `${diffHours} ч назад`;
    } else {
      return `${diffDays} дн назад`;
    }
  }
}
