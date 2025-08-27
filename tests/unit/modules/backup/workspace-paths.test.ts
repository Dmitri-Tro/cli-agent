import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupManager } from '../../../../src/modules/backup/managers/backup-manager';
import * as path from 'path';

// Mock fs operations
vi.mock('fs/promises');
vi.mock('fs');

describe('BackupManager - Workspace Paths', () => {
  let backupManager: BackupManager;

  describe('workspace directory usage', () => {
    it('should use workspace subdirectory by default', () => {
      backupManager = new BackupManager();
      
      // Access private property through type assertion for testing
      const backupDir = (backupManager as any).backupDirectory;
      
      expect(backupDir).toContain('workspace');
      expect(backupDir).toContain('.cli-agent-backups');
      expect(backupDir).not.toBe(process.cwd()); // Should not be project root
    });

    it('should use provided working directory', () => {
      const customWorkspace = path.resolve('/custom/workspace/path');
      backupManager = new BackupManager(customWorkspace);
      
      const backupDir = (backupManager as any).backupDirectory;
      
      // Normalize paths for cross-platform compatibility
      const normalizedBackupDir = path.normalize(backupDir);
      const normalizedCustom = path.normalize(customWorkspace);
      
      expect(normalizedBackupDir).toContain(normalizedCustom);
      expect(backupDir).toContain('.cli-agent-backups');
    });

    it('should include session ID in backup path', () => {
      backupManager = new BackupManager();
      
      const backupDir = (backupManager as any).backupDirectory;
      const sessionId = (backupManager as any).sessionId;
      
      expect(backupDir).toContain(sessionId);
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/); // session-timestamp-hash format
    });

    it('should use path.join for cross-platform compatibility', () => {
      const testPath = '/test/workspace';
      backupManager = new BackupManager(testPath);
      
      const backupDir = (backupManager as any).backupDirectory;
      
      // Should use proper path separators for the platform
      const expectedPath = path.join(testPath, '.cli-agent-backups');
      expect(backupDir).toContain(expectedPath);
    });
  });

  describe('session management', () => {
    it('should generate unique session IDs', () => {
      const manager1 = new BackupManager();
      const manager2 = new BackupManager();
      
      const sessionId1 = (manager1 as any).sessionId;
      const sessionId2 = (manager2 as any).sessionId;
      
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(sessionId2).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should include timestamp in session ID', () => {
      const beforeTime = Date.now();
      backupManager = new BackupManager();
      const afterTime = Date.now();
      
      const sessionId = (backupManager as any).sessionId;
      const timestamp = parseInt(sessionId.split('-')[1]); // session-TIMESTAMP-hash format
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('backup directory structure', () => {
    it('should create proper backup directory hierarchy', () => {
      const workspace = '/test/workspace';
      backupManager = new BackupManager(workspace);
      
      const backupDir = (backupManager as any).backupDirectory;
      const sessionId = (backupManager as any).sessionId;
      
      const expectedPath = path.join(workspace, '.cli-agent-backups', sessionId);
      expect(backupDir).toBe(expectedPath);
    });

    it('should handle Windows paths correctly', () => {
      const windowsPath = 'C:\\Users\\test\\workspace';
      backupManager = new BackupManager(windowsPath);
      
      const backupDir = (backupManager as any).backupDirectory;
      
      // Should not have mixed separators
      expect(backupDir).toContain(windowsPath);
      expect(backupDir).toContain('.cli-agent-backups');
    });

    it('should handle relative paths correctly', () => {
      const relativePath = './workspace';
      backupManager = new BackupManager(relativePath);
      
      const backupDir = (backupManager as any).backupDirectory;
      
      expect(backupDir).toContain('.cli-agent-backups');
      // Should resolve relative paths properly
      expect(path.isAbsolute(backupDir)).toBe(false); // Since we passed relative path
    });
  });

  describe('isolation from project root', () => {
    it('should not create backups in project root', () => {
      backupManager = new BackupManager();
      
      const backupDir = (backupManager as any).backupDirectory;
      const projectRoot = process.cwd();
      
      // Backup directory should be deeper than project root
      expect(backupDir).not.toBe(projectRoot);
      expect(backupDir).toContain('workspace');
      
      // Should be inside workspace subdirectory
      const expectedWorkspace = path.join(projectRoot, 'workspace');
      expect(backupDir).toContain(expectedWorkspace);
    });

    it('should maintain separation from source files', () => {
      const workspace = path.resolve('/test/workspace');
      backupManager = new BackupManager(workspace);
      
      const backupDir = (backupManager as any).backupDirectory;
      
      // Backup directory should be in hidden subfolder
      expect(backupDir).toContain('.cli-agent-backups');
      
      // Should not conflict with user files
      expect(backupDir).not.toBe(workspace);
      
      // Normalize paths for cross-platform comparison
      const normalizedBackupDir = path.normalize(backupDir);
      const normalizedWorkspace = path.normalize(workspace);
      expect(normalizedBackupDir.startsWith(normalizedWorkspace)).toBe(true);
    });
  });
});
