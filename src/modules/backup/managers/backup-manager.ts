import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import {
  appLogger,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
} from '../../core/logging/logger';

/**
 * Backup entry metadata
 */
export interface BackupEntry {
  id: string;
  timestamp: Date;
  operation: string;
  sourcePath: string;
  backupPath: string;
  checksum: string;
  metadata: {
    size: number;
    originalExists: boolean;
  };
}

/**
 * Backup operation result
 */
export interface BackupResult {
  success: boolean;
  backupEntry?: BackupEntry;
  backupPath?: string;
  error?: string;
}

/**
 * Backup cleanup options
 */
export interface CleanupOptions {
  maxAge?: number; // Maximum age in hours
  maxCount?: number; // Maximum number of backups to keep
  dryRun?: boolean; // Preview what would be deleted
}

/**
 * Backup Manager - handles creation and management of backup files
 * Provides safe backup operations with metadata tracking
 */
export class BackupManager {
  private readonly backupDirectory: string;
  private readonly workingDirectory: string;
  private readonly sessionId: string;
  private readonly backupHistory: Map<string, BackupEntry> = new Map();

  constructor(workingDirectory?: string) {
    // Use workspace/ subdirectory for all backup operations (consistency with filesystem)
    this.workingDirectory = workingDirectory || path.join(process.cwd(), 'workspace');
    this.sessionId = this.generateSessionId();
    this.backupDirectory = path.join(this.workingDirectory, '.cli-agent-backups', this.sessionId);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    const operationId = 'backup_manager_init';

    logOperationStart(appLogger, operationId, {
      backupDirectory: this.backupDirectory,
      sessionId: this.sessionId,
    });

    try {
      if (!existsSync(this.backupDirectory)) {
        await fs.mkdir(this.backupDirectory, { recursive: true });
      }

      logOperationSuccess(appLogger, operationId);
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      throw error;
    }
  }

  /**
   * Create backup of a file
   */
  async createBackup(sourcePath: string): Promise<BackupResult> {
    const operationId = `backup_create_${Date.now()}`;

    logOperationStart(appLogger, operationId, { sourcePath });

    try {
      await this.initialize();

      // Resolve source path relative to working directory
      const resolvedSource = path.resolve(this.workingDirectory, sourcePath);

      if (!existsSync(resolvedSource)) {
        return {
          success: false,
          error: `Source file does not exist: ${sourcePath}`,
        };
      }

      const stats = await fs.stat(resolvedSource);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Source is a directory, not a file: ${sourcePath}`,
        };
      }

      // Generate backup metadata
      const backupId = this.generateBackupId();
      const timestamp = new Date();
      const extension = path.extname(resolvedSource);
      const baseName = path.basename(resolvedSource, extension);
      const backupFileName = `${baseName}_${backupId}${extension}`;
      const backupPath = path.join(this.backupDirectory, backupFileName);

      // Copy file to backup location
      await fs.copyFile(resolvedSource, backupPath);

      // Calculate checksum
      const fileContent = await fs.readFile(backupPath);
      const checksum = createHash('sha256').update(fileContent).digest('hex');

      // Create backup entry
      const backupEntry: BackupEntry = {
        id: backupId,
        timestamp,
        operation: 'manual_backup',
        sourcePath: resolvedSource,
        backupPath,
        checksum,
        metadata: {
          size: stats.size,
          originalExists: true,
        },
      };

      // Save metadata
      await this.saveBackupMetadata(backupEntry);

      // Store in memory
      this.backupHistory.set(backupId, backupEntry);

      logOperationSuccess(appLogger, operationId, {
        backupId,
        backupPath,
        size: stats.size,
      });

      return {
        success: true,
        backupEntry,
        backupPath,
      };
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create backup of entire directory
   */
  async createDirectoryBackup(sourcePath: string): Promise<BackupResult> {
    const operationId = `backup_directory_${Date.now()}`;

    logOperationStart(appLogger, operationId, { sourcePath });

    try {
      const resolvedSource = path.resolve(sourcePath);

      if (!existsSync(resolvedSource)) {
        return {
          success: false,
          error: `Directory does not exist: ${sourcePath}`,
        };
      }

      const stats = await fs.stat(resolvedSource);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${sourcePath}`,
        };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dirName = path.basename(resolvedSource);
      const backupPath = path.join(this.backupDirectory, `${dirName}_${timestamp}`);

      // Copy directory recursively
      await this.copyDirectoryRecursive(resolvedSource, backupPath);

      logOperationSuccess(appLogger, operationId, {
        sourcePath: resolvedSource,
        backupPath,
      });

      return {
        success: true,
        backupPath,
      };
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Helper method to copy directory recursively
   */
  private async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Restore file from backup
   */
  async restoreBackup(backupId: string, targetPath?: string): Promise<BackupResult> {
    const operationId = `backup_restore_${backupId}`;

    logOperationStart(appLogger, operationId, { backupId, targetPath });

    try {
      const backupEntry = this.backupHistory.get(backupId);

      if (!backupEntry) {
        return {
          success: false,
          error: `Backup not found: ${backupId}`,
        };
      }

      if (!existsSync(backupEntry.backupPath)) {
        return {
          success: false,
          error: `Backup file not found: ${backupEntry.backupPath}`,
        };
      }

      const restorePath = targetPath || backupEntry.sourcePath;
      const resolvedRestorePath = path.resolve(this.workingDirectory, restorePath);

      // Verify backup integrity
      const backupContent = await fs.readFile(backupEntry.backupPath);
      const currentChecksum = createHash('sha256').update(backupContent).digest('hex');

      if (currentChecksum !== backupEntry.checksum) {
        return {
          success: false,
          error: `Backup integrity check failed for: ${backupId}`,
        };
      }

      // Create parent directory if needed
      const parentDir = path.dirname(resolvedRestorePath);
      if (!existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      // Restore file
      await fs.copyFile(backupEntry.backupPath, resolvedRestorePath);

      logOperationSuccess(appLogger, operationId, {
        backupId,
        restoredTo: resolvedRestorePath,
      });

      return {
        success: true,
        backupEntry,
      };
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get backup history
   */
  getBackupHistory(): BackupEntry[] {
    return Array.from(this.backupHistory.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId: string): BackupEntry | undefined {
    return this.backupHistory.get(backupId);
  }

  /**
   * Clean up old backups
   */
  async cleanup(
    options: CleanupOptions = {}
  ): Promise<{ deleted: string[]; kept: string[]; errors: string[] }> {
    const operationId = 'backup_cleanup';

    logOperationStart(appLogger, operationId, options as Record<string, unknown>);

    const { maxAge = 24, maxCount = 100, dryRun = false } = options;
    const deleted: string[] = [];
    const kept: string[] = [];
    const errors: string[] = [];

    try {
      const backups = this.getBackupHistory();
      const now = new Date();
      const maxAgeMs = maxAge * 60 * 60 * 1000; // Convert hours to milliseconds

      // Determine which backups to delete
      const toDelete: BackupEntry[] = [];
      const toKeep: BackupEntry[] = [];

      for (let i = 0; i < backups.length; i++) {
        const backup = backups[i];
        if (!backup) continue;

        const age = now.getTime() - backup.timestamp.getTime();

        // Keep if within count limit and age limit
        if (i < maxCount && age < maxAgeMs) {
          toKeep.push(backup);
        } else {
          toDelete.push(backup);
        }
      }

      // Delete old backups
      for (const backup of toDelete) {
        try {
          if (!dryRun) {
            if (existsSync(backup.backupPath)) {
              await fs.unlink(backup.backupPath);
            }

            // Remove metadata file
            const metadataPath = path.join(this.backupDirectory, `${backup.id}.metadata.json`);
            if (existsSync(metadataPath)) {
              await fs.unlink(metadataPath);
            }

            // Remove from memory
            this.backupHistory.delete(backup.id);
          }

          deleted.push(backup.id);
        } catch (error) {
          errors.push(
            `Failed to delete backup ${backup.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Track kept backups
      toKeep.forEach(backup => kept.push(backup.id));

      logOperationSuccess(appLogger, operationId, {
        deleted: deleted.length,
        kept: kept.length,
        errors: errors.length,
        dryRun,
      });

      return { deleted, kept, errors };
    } catch (error) {
      logOperationFailure(appLogger, operationId, error);
      throw error;
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Save backup metadata to JSON file
   */
  private async saveBackupMetadata(backupEntry: BackupEntry): Promise<void> {
    const metadataPath = path.join(this.backupDirectory, `${backupEntry.id}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(backupEntry, null, 2), 'utf8');
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get backup directory path
   */
  getBackupDirectory(): string {
    return this.backupDirectory;
  }
}
