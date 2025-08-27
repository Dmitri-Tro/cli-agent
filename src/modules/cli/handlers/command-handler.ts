import type {
  CommandIntent,
  CreateDirectoryIntent,
  CreateFileIntent,
  WriteFileIntent,
  DeleteFileIntent,
  DeleteDirectoryIntent,
  ModifyFileIntent,
  CopyFileIntent,
  MoveFileIntent,
  RenameFileIntent,
  ListDirectoryIntent,
  ReadFileIntent,
  UndoIntent,
  ExplainIntent,
} from '../../core';

import type { BackupResult } from '../../backup';

import {
  CLIAgentError,
  ErrorCode,
  ErrorFactory,
  errorHandler,
} from '../../core';

import { FilesystemService } from '../../filesystem';
import { BackupService } from '../../backup';

/**
 * Command Handler - executes CLI commands
 * Coordinates between different modules to perform operations
 */
export class CommandHandler {
  private readonly filesystemService: FilesystemService;
  private readonly backupService: BackupService;
  private operationMutex = false;
  private currentOperation: { intent: CommandIntent; startTime: number } | null = null;

  constructor(workingDirectory?: string) {
    this.filesystemService = new FilesystemService(workingDirectory);
    this.backupService = new BackupService(workingDirectory);
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    await this.backupService.initialize();
  }

  /**
   * Execute a command intent
   */

  async executeCommand(
    intent: CommandIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Check if another operation is already running (atomic operations)
    if (this.operationMutex) {
      throw ErrorFactory.operationMutexLocked(
        this.currentOperation?.intent.type || 'unknown'
      );
    }

    // Lock execution to prevent concurrent operations
    this.operationMutex = true;
    this.currentOperation = { intent, startTime: Date.now() };

    console.log('\n⚡ Выполнение операции...');

    try {
      switch (intent.type) {
        // File operations
        case 'create_file':
          await this.handleCreateFile(intent as CreateFileIntent);
          break;

        case 'write_file':
          await this.handleWriteFile(intent as WriteFileIntent, confirmationCallback);
          break;

        case 'read_file':
          await this.handleReadFile(intent as ReadFileIntent);
          break;

        case 'delete_file':
          await this.handleDeleteFile(intent as DeleteFileIntent, confirmationCallback);
          break;

        case 'modify_file':
          await this.handleModifyFile(intent as ModifyFileIntent, confirmationCallback);
          break;

        case 'copy_file':
          await this.handleCopyFile(intent as CopyFileIntent);
          break;

        case 'move_file':
          await this.handleMoveFile(intent as MoveFileIntent, confirmationCallback);
          break;

        case 'rename_file':
          await this.handleRenameFile(intent as RenameFileIntent, confirmationCallback);
          break;

        // Directory operations
        case 'create_directory':
          await this.handleCreateDirectory(intent as CreateDirectoryIntent);
          break;

        case 'delete_directory':
          await this.handleDeleteDirectory(intent as DeleteDirectoryIntent, confirmationCallback);
          break;

        case 'list_directory':
          await this.handleListDirectory(intent as ListDirectoryIntent);
          break;

        // System operations
        case 'undo':
          await this.handleUndo(intent as UndoIntent);
          break;

        case 'explain':
          await this.handleExplain(intent as ExplainIntent);
          break;

        default:
          throw ErrorFactory.commandInvalidIntent(
            intent,
            `Неизвестная операция: ${(intent as Record<string, unknown>).type || 'unknown'}`
          );
      }
    } catch (error) {
      await errorHandler.handleError(error, intent.type, {
        showDetails: true,
        logError: true,
        attemptRecovery: true,
        context: { 
          operation: intent.type,
          mutexLocked: this.operationMutex,
          currentOperation: this.currentOperation
        }
      });
    } finally {
      // Always release the mutex and clear current operation
      this.operationMutex = false;
      this.currentOperation = null;
    }
  }

  /**
   * Handle interruption during operation (Ctrl+C)
   * Attempts to rollback current operation if possible
   */
  async handleInterruption(): Promise<void> {
    if (!this.currentOperation) {
      return;
    }

    const { intent, startTime } = this.currentOperation;
    const duration = Date.now() - startTime;

    console.log(`\n⚠️ Прерывание операции "${intent.type}" (выполнялась ${duration}ms)`);

    // Only attempt rollback for modifying operations
    const modifyingOperations = [
      'create_file', 'create_directory', 'write_file', 
      'delete_file', 'delete_directory', 'move_file', 'rename_file'
    ];

    if (modifyingOperations.includes(intent.type)) {
      console.log('🔄 Попытка отката изменений...');
      
      try {
        // Attempt to undo the last operation if it was partially completed
        const undoResults = await this.backupService.undoOperations(1);
        
        if (undoResults.length > 0 && undoResults[0]?.success) {
          console.log('✅ Изменения успешно отменены');
        } else {
          console.log('⚠️ Не удалось полностью отменить изменения. Проверьте состояние файлов.');
        }
      } catch (error) {
        console.log(`❌ Ошибка отката: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Clear operation state
    this.operationMutex = false;
    this.currentOperation = null;
  }

  /**
   * Check if an operation is currently running
   */
  isOperationRunning(): boolean {
    return this.operationMutex;
  }

  /**
   * Get current operation info
   */
  getCurrentOperation(): { intent: CommandIntent; startTime: number } | null {
    return this.currentOperation;
  }

  // File operation handlers
  private async handleCreateFile(intent: CreateFileIntent): Promise<void> {
    const content = intent.content || ''; // Default to empty string if no content
    const result = await this.filesystemService.createFile(intent.path, content, {
      overwrite: intent.overwrite,
    });

    if (result.success) {
      console.log(`✅ ${result.message}`);
      
      // Create backup of the created file for precise restoration capability
      const backupResult = await this.backupService.createBackup(intent.path);
      const backupId = backupResult.success ? backupResult.backupEntry?.id || null : null;
      
      await this.backupService.recordOperation({
        type: 'create_file',
        targetPath: intent.path,
        originalData: backupId, // Store backup ID for precise restoration
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error creating file'
      );
    }
  }

  private async handleWriteFile(
    intent: WriteFileIntent,
    _confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Create backup before writing (if file exists)
    let backupId: string | null = null;
    try {
      const backupResult = await this.backupService.createBackup(intent.path);
      backupId = backupResult.success ? backupResult.backupEntry?.id || null : null;
    } catch {
      // File doesn't exist yet, no backup needed
    }

    // Convert overwrite boolean to WriteFileMode enum
    const mode = intent.overwrite ? 'overwrite' : 'append';
    const result = await this.filesystemService.writeFile(intent.path, intent.content, mode);

    if (result.success) {
      console.log(`✅ ${result.message}`);
      
      // Record undo operation with backup ID for proper restoration
      await this.backupService.recordOperation({
        type: 'write_file',
        targetPath: intent.path,
        originalData: backupId, // Store backup ID for precise restoration
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error writing file'
      );
    }
  }

  private async handleReadFile(intent: ReadFileIntent): Promise<void> {
    const result = await this.filesystemService.readFile(
      intent.path,
      intent.lines,
      intent.fromLine
    );

    if (result.success) {
      console.log(`📄 ${result.message}`);
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error reading file'
      );
    }
  }

  private async handleDeleteFile(
    intent: DeleteFileIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Ask for confirmation if required
    if (intent.confirm && confirmationCallback) {
      const confirmed = await confirmationCallback(
        `Удалить файл '${intent.path}'? Это действие нельзя отменить.`
      );
      if (!confirmed) {
        console.log('⏹️ Операция отменена пользователем');
        return;
      }
    }

    const result = await this.filesystemService.deleteFile(intent.path);

    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Record undo operation (simple approach like directories)
      await this.backupService.recordOperation({
        type: 'delete_file',
        targetPath: intent.path,
        originalData: intent.path,
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error deleting file'
      );
    }
  }

  // Directory operation handlers
  private async handleCreateDirectory(intent: CreateDirectoryIntent): Promise<void> {
    const result = await this.filesystemService.createDirectory(intent.path, {
      recursive: intent.recursive,
    });

    if (result.success) {
      console.log(`✅ ${result.message}`);
      
      // Record the creation operation for undo capability
      await this.backupService.recordOperation({
        type: 'create_directory',
        targetPath: intent.path,
        originalData: null, // Directory creation doesn't need backup content
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.FILESYSTEM_OPERATION_FAILED,
        result.error || 'Не удалось создать директорию'
      );
    }
  }

  // Simplified implementations for remaining handlers...

  private async handleModifyFile(
    intent: ModifyFileIntent,
    _confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Check if file exists before modifying
    const fileExists = await this.filesystemService.exists(intent.path);
    if (!fileExists) {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        `Файл '${intent.path}' не найден`
      );
    }

    // Create backup before modifying (mandatory for existing files)
    const backupResult = await this.backupService.createBackup(intent.path);
    if (!backupResult.success || !backupResult.backupEntry?.id) {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        `Не удалось создать резервную копию файла '${intent.path}': ${backupResult.error || 'Unknown backup error'}`
      );
    }

    const backupId = backupResult.backupEntry.id;

    const result = await this.filesystemService.modifyFile(
      intent.path,
      intent.search,
      intent.replace,
      intent.global
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
      
      // Record undo operation with backup ID for proper restoration
      await this.backupService.recordOperation({
        type: 'modify_file',
        targetPath: intent.path,
        originalData: backupId, // Store backup ID for precise restoration
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error modifying file'
      );
    }
  }

  private async handleCopyFile(
    intent: CopyFileIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    let backupResult: BackupResult = { success: false };

    // Create backup if destination file exists and will be overwritten
    if (intent.overwrite) {
      try {
        backupResult = await this.backupService.createBackup(intent.destinationPath);
      } catch {
        // File doesn't exist, no backup needed
      }

      if (confirmationCallback) {
        const confirmed = await confirmationCallback(
          `Файл назначения может быть перезаписан. Продолжить копирование ${intent.sourcePath} → ${intent.destinationPath}?`
        );
        if (!confirmed) {
          console.log('⏹️ Операция отменена пользователем');
          return;
        }
      }
    }

    const result = await this.filesystemService.copyFile(
      intent.sourcePath,
      intent.destinationPath,
      intent.overwrite
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Record undo operation
      await this.backupService.recordOperation({
        type: 'delete_file',
        targetPath: intent.destinationPath,
        originalData: backupResult.success ? backupResult.backupEntry?.id || null : null,
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error copying file'
      );
    }
  }

  private async handleMoveFile(
    intent: MoveFileIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Check if destination exists and ask for confirmation
    if (intent.overwrite && confirmationCallback) {
      const confirmed = await confirmationCallback(
        `Файл назначения может быть перезаписан. Продолжить перемещение ${intent.sourcePath} → ${intent.destinationPath}?`
      );
      if (!confirmed) {
        console.log('⏹️ Операция отменена пользователем');
        return;
      }
    }

    const result = await this.filesystemService.moveFile(
      intent.sourcePath,
      intent.destinationPath,
      intent.overwrite
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Record undo operation
      await this.backupService.recordOperation({
        type: 'move_file',
        targetPath: intent.destinationPath,
        originalData: intent.sourcePath,
      });
    } else {
      throw new CLIAgentError(ErrorCode.UNKNOWN_ERROR, result.error || 'Unknown error moving file');
    }
  }

  private async handleRenameFile(
    intent: RenameFileIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Check if destination exists and ask for confirmation
    if (intent.overwrite && confirmationCallback) {
      const confirmed = await confirmationCallback(
        `Файл с именем '${intent.newName}' может быть перезаписан. Продолжить переименование?`
      );
      if (!confirmed) {
        console.log('⏹️ Операция отменена пользователем');
        return;
      }
    }

    const result = await this.filesystemService.renameFile(
      intent.path,
      intent.newName,
      intent.overwrite
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Record undo operation
      await this.backupService.recordOperation({
        type: 'rename_file',
        targetPath: result.path || intent.path,
        originalData: intent.path,
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error renaming file'
      );
    }
  }

  private async handleDeleteDirectory(
    intent: DeleteDirectoryIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    // Ask for confirmation if required
    if (intent.confirm && confirmationCallback) {
      const confirmed = await confirmationCallback(
        `Удалить директорию '${intent.path}' ${intent.recursive ? 'со всем содержимым' : ''}? Это действие нельзя отменить.`
      );
      if (!confirmed) {
        console.log('⏹️ Операция отменена пользователем');
        return;
      }
    }

    const result = await this.filesystemService.deleteDirectory(intent.path, intent.recursive);

    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Record undo operation (directories need special handling)
      await this.backupService.recordOperation({
        type: 'delete_directory',
        targetPath: intent.path,
        originalData: intent.path, // Store path for recreation
      });
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error deleting directory'
      );
    }
  }

  private async handleListDirectory(intent: ListDirectoryIntent): Promise<void> {
    const result = await this.filesystemService.listDirectory(intent.path, intent.detailed);

    if (result.success) {
      console.log(`📂 ${result.message}`);
    } else {
      throw new CLIAgentError(
        ErrorCode.UNKNOWN_ERROR,
        result.error || 'Unknown error listing directory'
      );
    }
  }

  // System operation handlers
  private async handleUndo(_intent: UndoIntent): Promise<void> {
    // Always undo only the last operation (sequential undo limitation)
    const results = await this.backupService.undoOperations(1);

    if (results.length === 0) {
      console.log('❌ Нет операций для отмены');
      return;
    }

    const result = results[0];
    if (!result) {
      console.log('❌ Ошибка получения результата отмены');
      return;
    }

    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`🔄 Отменена последняя операция`);
    } else {
      console.log(`❌ ${result.message}: ${result.error || 'Неизвестная ошибка'}`);
      console.log(`⚠️ Не удалось отменить последнюю операцию`);
    }
  }



  private async handleExplain(intent: ExplainIntent): Promise<void> {
    const message = intent.message || 'Объяснение команды';
    console.log(`📖 ${message}`);
  }

  /**
   * Get backup service for external access
   */
  getBackupService(): BackupService {
    return this.backupService;
  }
}
