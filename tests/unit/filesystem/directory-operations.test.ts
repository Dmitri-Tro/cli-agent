/**
 * Directory Operations Unit Tests
 * Tests for ISSUE-002: Directory deletion logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DirectoryOperations } from '../../../src/modules/filesystem/operations/directory-operations';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readdir: vi.fn(),
  rmdir: vi.fn(),
  rm: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('DirectoryOperations Unit Tests (ISSUE-002)', () => {
  let directoryOps: DirectoryOperations;
  let mockFs: any;
  let mockExistsSync: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Import mocked modules
    mockFs = await import('fs/promises');
    const fs = await import('fs');
    mockExistsSync = fs.existsSync;
    
    directoryOps = new DirectoryOperations('test-workspace');
  });

  describe('deleteDirectory method', () => {
    it('should use rmdir for empty directories when recursive=false', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue([]); // Empty directory
      mockFs.rmdir.mockResolvedValue(undefined);

      const result = await directoryOps.deleteDirectory('empty-dir', false);

      expect(result.success).toBe(true);
      expect(mockFs.rmdir).toHaveBeenCalledWith(expect.stringContaining('empty-dir'));
      expect(mockFs.rm).not.toHaveBeenCalled(); // Should not use rm for empty dirs
    });

    it('should fail for non-empty directories when recursive=false', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue(['file.txt']); // Non-empty directory

      const result = await directoryOps.deleteDirectory('non-empty-dir', false);

      expect(result.success).toBe(false);
      expect(result.message).toContain('не пуста');
      expect(mockFs.rmdir).not.toHaveBeenCalled();
      expect(mockFs.rm).not.toHaveBeenCalled();
    });

    it('should use fs.rm with recursive=true for non-empty directories', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.rm.mockResolvedValue(undefined);

      const result = await directoryOps.deleteDirectory('any-dir', true);

      expect(result.success).toBe(true);
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('any-dir'),
        { recursive: true, force: true }
      );
      expect(mockFs.rmdir).not.toHaveBeenCalled(); // Should not use rmdir with recursive
    });

    it('should handle non-existent directories gracefully', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(false);

      const result = await directoryOps.deleteDirectory('non-existent', false);

      expect(result.success).toBe(false);
      expect(result.message).toContain('не существует');
    });

    it('should handle files incorrectly passed as directories', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false });

      const result = await directoryOps.deleteDirectory('file.txt', false);

      expect(result.success).toBe(false);
      expect(result.message).toContain('файл');
    });

    it('should handle filesystem errors gracefully', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue([]);
      mockFs.rmdir.mockRejectedValue(new Error('Permission denied'));

      const result = await directoryOps.deleteDirectory('protected-dir', false);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error message encoding', () => {
    it('should provide cyrillic error messages through CyrillicDecoder', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(false);

      const result = await directoryOps.deleteDirectory('тест', false);

      expect(result.success).toBe(false);
      // Should not contain corrupted characters
      expect(result.message).not.toMatch(/[ðÐ][^а-яё]/);
      // Should contain cyrillic or be safe message
      expect(result.message).toMatch(/[а-яё]|not|exist/i);
    });

    it('should handle cyrillic directory names in success messages', async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true });
      mockFs.readdir.mockResolvedValue([]);
      mockFs.rmdir.mockResolvedValue(undefined);

      const result = await directoryOps.deleteDirectory('русская_папка', false);

      expect(result.success).toBe(true);
      expect(result.message).toContain('русская_папка');
      expect(result.message).not.toMatch(/[ðÐ][^а-яё]/);
    });
  });
});
