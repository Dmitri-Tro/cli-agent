/**
 * Backup Module
 *
 * Provides comprehensive backup and undo functionality:
 * - File and directory backup with metadata tracking
 * - Operation history and undo capabilities
 * - Automatic cleanup and maintenance
 * - Integrity verification with checksums
 */

// Main service
export { BackupService } from './backup.service';

// Backup management
export { BackupManager } from './managers/backup-manager';
export type { BackupEntry, BackupResult, CleanupOptions } from './managers/backup-manager';

// Undo system
export { UndoSystem } from './undo/undo-system';
export type {
  UndoOperation,
  UndoOperationType,
  UndoResult,
  UndoStatistics,
} from './undo/undo-system';
