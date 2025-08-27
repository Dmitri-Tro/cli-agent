import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UndoSystem } from '../../../../src/modules/backup/undo/undo-system';
import { BackupManager } from '../../../../src/modules/backup/managers/backup-manager';

// Mock the backup manager
vi.mock('../../../../src/modules/backup/managers/backup-manager');

describe('UndoSystem - write_file operations', () => {
  let undoSystem: UndoSystem;
  let mockBackupManager: any;

  beforeEach(() => {
    // Create mock backup manager
    mockBackupManager = {
      restoreBackup: vi.fn(),
      createBackup: vi.fn(),
      getBackupHistory: vi.fn().mockReturnValue([])
    };

    // Create undo system with mocked backup manager
    undoSystem = new UndoSystem(mockBackupManager, '/test/workspace');
  });

  describe('recordOperation for write_file', () => {
    it('should record write_file operation with backup ID', async () => {
      const operation = {
        type: 'write_file' as const,
        targetPath: 'test.txt',
        originalData: 'backup-id-123'
      };

      // Should not throw when recording operation
      await expect(undoSystem.recordOperation(operation)).resolves.not.toThrow();
    });

    it('should record truncate_file operation', async () => {
      const operation = {
        type: 'truncate_file' as const,
        targetPath: 'test.txt',
        originalData: 'backup-id-456'
      };

      // Should not throw when recording operation
      await expect(undoSystem.recordOperation(operation)).resolves.not.toThrow();
    });
  });

  describe('undoOperations for write_file', () => {
    it('should restore file from backup on undo', async () => {
      // Setup mock to return successful restore
      mockBackupManager.restoreBackup.mockResolvedValue({
        success: true,
        backupEntry: { id: 'backup-123' }
      });

      // Record a write_file operation
      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'test.txt',
        originalData: 'backup-123'
      });

      // Undo the operation
      const results = await undoSystem.undoOperations(1);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].message).toContain('успешно восстановлен');
      
      // Verify backup manager was called correctly
      expect(mockBackupManager.restoreBackup).toHaveBeenCalledWith('backup-123', 'test.txt');
    });

    it('should handle failed backup restore gracefully', async () => {
      // Setup mock to return failed restore
      mockBackupManager.restoreBackup.mockResolvedValue({
        success: false,
        error: 'Backup file not found'
      });

      // Record a write_file operation
      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'test.txt',
        originalData: 'backup-456'
      });

      // Undo the operation
      const results = await undoSystem.undoOperations(1);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Не удалось восстановить файл');
      expect(results[0].error).toBe('Backup file not found');
    });

    it('should handle missing backup ID', async () => {
      // Record operation without backup ID
      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'test.txt',
        originalData: null
      });

      // Undo the operation
      const results = await undoSystem.undoOperations(1);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Нет резервной копии');
      expect(results[0].error).toBe('No backup ID available');
    });

    it('should handle truncate_file operations same as write_file', async () => {
      // Setup mock to return successful restore
      mockBackupManager.restoreBackup.mockResolvedValue({
        success: true,
        backupEntry: { id: 'backup-789' }
      });

      // Record a truncate_file operation
      await undoSystem.recordOperation({
        type: 'truncate_file',
        targetPath: 'test.txt',
        originalData: 'backup-789'
      });

      // Undo the operation
      const results = await undoSystem.undoOperations(1);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify same restore logic is used
      expect(mockBackupManager.restoreBackup).toHaveBeenCalledWith('backup-789', 'test.txt');
    });
  });

  describe('statistics and history', () => {
    it('should provide statistics interface', async () => {
      // Statistics should be available
      const stats = undoSystem.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.undoableOperations).toBe('number');

      // Record operations should not throw
      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'test1.txt',
        originalData: 'backup-1'
      });

      await undoSystem.recordOperation({
        type: 'truncate_file',
        targetPath: 'test2.txt',
        originalData: 'backup-2'
      });

      // Should still provide valid statistics after operations
      const newStats = undoSystem.getStatistics();
      expect(newStats).toBeDefined();
      expect(typeof newStats.undoableOperations).toBe('number');
    });

    it('should handle multiple undo operations in correct order', async () => {
      // Setup mock
      mockBackupManager.restoreBackup.mockResolvedValue({
        success: true,
        backupEntry: { id: 'backup' }
      });

      // Record operations in order
      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'first.txt',
        originalData: 'backup-first'
      });

      await undoSystem.recordOperation({
        type: 'write_file',
        targetPath: 'second.txt',
        originalData: 'backup-second'
      });

      // Undo last 2 operations
      const results = await undoSystem.undoOperations(2);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Should be called in reverse order (LIFO)
      expect(mockBackupManager.restoreBackup).toHaveBeenNthCalledWith(1, 'backup-second', 'second.txt');
      expect(mockBackupManager.restoreBackup).toHaveBeenNthCalledWith(2, 'backup-first', 'first.txt');
    });
  });
});
