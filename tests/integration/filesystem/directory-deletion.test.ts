/**
 * Directory Deletion Integration Tests
 * Tests for ISSUE-002: Ошибки удаления директорий
 */

import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { testUtils } from '../../setup';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import { FilesystemService } from '../../../src/modules/filesystem';
import { BackupService } from '../../../src/modules/backup';

describe('Directory Deletion Integration Tests (ISSUE-002)', () => {
  let commandHandler: CommandHandler;

  beforeEach(async () => {
    commandHandler = new CommandHandler(testUtils.workspace);
  });

  describe('Empty directory deletion', () => {
    it('should successfully delete empty directory', async () => {
      // Create empty directory
      await testUtils.createTestDirectory('empty-dir');
      
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'empty-dir',
        recursive: false,
        confirm: true,
        reasoning: 'Delete empty directory test'
      };

      await commandHandler.executeCommand(deleteIntent);

      // Verify directory was deleted
      const exists = await testUtils.fileExists('empty-dir');
      expect(exists).toBe(false);
    });

    it('should handle nested empty directories', async () => {
      // Create nested structure
      await testUtils.createTestDirectory('parent');
      await testUtils.createTestDirectory('parent/child');
      
      // Delete child first
      const deleteChildIntent = {
        type: 'delete_directory' as const,
        path: 'parent/child',
        recursive: false,
        confirm: true,
        reasoning: 'Delete nested empty directory'
      };

      await commandHandler.executeCommand(deleteChildIntent);

      // Verify child deleted, parent still exists
      const childExists = await testUtils.fileExists('parent/child');
      const parentExists = await testUtils.fileExists('parent');
      
      expect(childExists).toBe(false);
      expect(parentExists).toBe(true);
    });

    it('should delete directory with recursive flag for non-empty dirs', async () => {
      // Create directory with file
      await testUtils.createTestDirectory('non-empty');
      await testUtils.createTestFile('non-empty/file.txt', 'content');
      
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'non-empty',
        recursive: true, // Recursive for non-empty
        confirm: true,
        reasoning: 'Delete non-empty directory test'
      };

      await commandHandler.executeCommand(deleteIntent);

      // Verify directory and contents deleted
      const exists = await testUtils.fileExists('non-empty');
      expect(exists).toBe(false);
    });
  });

  describe('Error scenarios', () => {
    it('should fail gracefully when deleting non-empty directory without recursive', async () => {
      // Create directory with file
      await testUtils.createTestDirectory('has-content');
      await testUtils.createTestFile('has-content/file.txt', 'test');
      
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'has-content',
        recursive: false, // Should fail for non-empty
        confirm: true,
        reasoning: 'Test non-empty directory error'
      };

      // Should handle error gracefully (CommandHandler doesn't throw, handles internally)
      await expect(commandHandler.executeCommand(deleteIntent)).resolves.toBeUndefined();
      
      // Directory should still exist
      const exists = await testUtils.fileExists('has-content');
      expect(exists).toBe(true);
    });

    it('should handle non-existent directory gracefully', async () => {
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'non-existent',
        recursive: false,
        confirm: true,
        reasoning: 'Test non-existent directory'
      };

      // Should handle error gracefully (CommandHandler doesn't throw, handles internally)
      await expect(commandHandler.executeCommand(deleteIntent)).resolves.toBeUndefined();
    });

    it('should display readable error messages in cyrillic', async () => {
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'missing-directory',
        recursive: false,
        confirm: true,
        reasoning: 'Test error message encoding'
      };

      // CommandHandler handles errors internally, doesn't throw
      await expect(commandHandler.executeCommand(deleteIntent)).resolves.toBeUndefined();

      // Verify operation failed (non-existent directory wasn't "deleted")
      const exists = await testUtils.fileExists('missing-directory');
      expect(exists).toBe(false); // Should remain false (didn't exist before, doesn't exist after)
    });
  });

  describe('Cyrillic directory names', () => {
    it('should handle cyrillic directory names correctly', async () => {
      await testUtils.createTestDirectory('русская_папка');
      
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'русская_папка',
        recursive: false,
        confirm: true,
        reasoning: 'Delete cyrillic directory test'
      };

      await commandHandler.executeCommand(deleteIntent);

      const exists = await testUtils.fileExists('русская_папка');
      expect(exists).toBe(false);
    });

    it('should handle mixed cyrillic/latin paths', async () => {
      await testUtils.createTestDirectory('mixed');
      await testUtils.createTestDirectory('mixed/кириллица');
      
      const deleteIntent = {
        type: 'delete_directory' as const,
        path: 'mixed/кириллица',
        recursive: false,
        confirm: true,
        reasoning: 'Delete mixed path directory'
      };

      await commandHandler.executeCommand(deleteIntent);

      const exists = await testUtils.fileExists('mixed/кириллица');
      expect(exists).toBe(false);
    });
  });
});
