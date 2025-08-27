import { BackupManager } from './managers/backup-manager';
import { UndoSystem } from './undo/undo-system';
import type { BackupResult, BackupEntry, CleanupOptions } from './managers/backup-manager';
import type { UndoResult, UndoStatistics, UndoOperation } from './undo/undo-system';

/**
 * Backup Service - unified interface for backup and undo operations
 * Coordinates between BackupManager and UndoSystem
 */
export class BackupService {
  private readonly backupManager: BackupManager;
  private readonly undoSystem: UndoSystem;

  constructor(workingDirectory?: string) {
    this.backupManager = new BackupManager(workingDirectory);
    this.undoSystem = new UndoSystem(this.backupManager, workingDirectory);
  }

  /**
   * Initialize the backup service
   */
  async initialize(): Promise<void> {
    await this.backupManager.initialize();
  }

  // Backup operations
  async createBackup(sourcePath: string): Promise<BackupResult> {
    return this.backupManager.createBackup(sourcePath);
  }

  async createDirectoryBackup(sourcePath: string): Promise<BackupResult> {
    return this.backupManager.createDirectoryBackup(sourcePath);
  }

  async restoreBackup(backupId: string, targetPath?: string): Promise<BackupResult> {
    return this.backupManager.restoreBackup(backupId, targetPath);
  }

  getBackupHistory(): BackupEntry[] {
    return this.backupManager.getBackupHistory();
  }

  getBackup(backupId: string): BackupEntry | undefined {
    return this.backupManager.getBackup(backupId);
  }

  async cleanupBackups(
    options?: CleanupOptions
  ): Promise<{ deleted: string[]; kept: string[]; errors: string[] }> {
    return this.backupManager.cleanup(options);
  }

  // Undo operations
  async recordOperation(operation: Omit<UndoOperation, 'id' | 'timestamp'>): Promise<void> {
    return this.undoSystem.recordOperation(operation);
  }

  async undoOperations(steps = 1): Promise<UndoResult[]> {
    return this.undoSystem.undoOperations(steps);
  }

  getHistorySummary(): string[] {
    return this.undoSystem.getHistorySummary();
  }

  getStatistics(): UndoStatistics {
    return this.undoSystem.getStatistics();
  }

  getUndoableCount(): number {
    return this.undoSystem.getUndoableCount();
  }

  clearHistory(): void {
    this.undoSystem.clearHistory();
  }

  // Utility methods
  getSessionId(): string {
    return this.backupManager.getSessionId();
  }

  getBackupDirectory(): string {
    return this.backupManager.getBackupDirectory();
  }

  /**
   * Perform cleanup on service shutdown
   */
  async cleanup(): Promise<void> {
    // Clean up old backups (keep last 24 hours, max 50 backups)
    await this.backupManager.cleanup({
      maxAge: 24,
      maxCount: 50,
      dryRun: false,
    });
  }
}
