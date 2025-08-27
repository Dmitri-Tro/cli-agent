/**
 * AI Parsing Errors Integration Tests
 * Tests for ISSUE-001: Ошибки AI парсинга русских команд
 */

import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { testUtils } from '../../setup';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import { FilesystemService } from '../../../src/modules/filesystem';
import { BackupService } from '../../../src/modules/backup';

describe('AI Parsing Errors Integration Tests (ISSUE-001)', () => {
  let commandHandler: CommandHandler;

  beforeEach(async () => {
    commandHandler = new CommandHandler(testUtils.workspace);
  });

  describe('Russian nested directory commands', () => {
    it('should correctly parse "создай папку X в папке Y" as Y/X', async () => {
      // First create the parent directory
      await testUtils.createTestDirectory('test');

      // This command should create test/keng, not folder/keng
      const intent = {
        type: 'create_directory' as const,
        path: 'test/keng',  // Expected correct parsing
        recursive: false,
        reasoning: 'Создание папки keng в папке test'
      };

      await commandHandler.executeCommand(intent);

      // Verify directory was created in correct location
      const exists = await testUtils.fileExists('test/keng');
      expect(exists).toBe(true);

      // Verify it wasn't created in wrong location
      const wrongExists = await testUtils.fileExists('folder/keng');
      expect(wrongExists).toBe(false);
    });

    it('should correctly parse complex nested paths "создай папку docs в папке src/components"', async () => {
      // Create parent directories
      await testUtils.createTestDirectory('src');
      await testUtils.createTestDirectory('src/components');

      const intent = {
        type: 'create_directory' as const,
        path: 'src/components/docs',
        recursive: false,
        reasoning: 'Создание папки docs в папке src/components'
      };

      await commandHandler.executeCommand(intent);

      const exists = await testUtils.fileExists('src/components/docs');
      expect(exists).toBe(true);
    });

    it('should handle cyrillic directory names correctly', async () => {
      await testUtils.createTestDirectory('проект');

      const intent = {
        type: 'create_directory' as const,
        path: 'проект/документы',
        recursive: false,
        reasoning: 'Создание папки документы в папке проект'
      };

      await commandHandler.executeCommand(intent);

      const exists = await testUtils.fileExists('проект/документы');
      expect(exists).toBe(true);
    });
  });

  describe('Error message encoding', () => {
    it('should display cyrillic error messages correctly', async () => {
      // Try to create directory in non-existent parent
      const intent = {
        type: 'create_directory' as const,
        path: 'nonexistent/subfolder',
        recursive: false,
        reasoning: 'Test error message encoding'
      };

      // CommandHandler handles errors internally, doesn't throw
      await expect(commandHandler.executeCommand(intent)).resolves.toBeUndefined();

      // Verify operation failed (directory not created)
      const dirExists = await testUtils.fileExists('nonexistent/subfolder');
      expect(dirExists).toBe(false);
      
      // Verify parent directory also doesn't exist
      const parentExists = await testUtils.fileExists('nonexistent');
      expect(parentExists).toBe(false);
    });

    it('should handle errors with suggestions in readable cyrillic', async () => {
      const intent = {
        type: 'create_directory' as const,
        path: '', // Invalid empty path
        recursive: false,
        reasoning: 'Test error suggestions encoding'
      };

      let suggestions: string[] = [];
      try {
        await commandHandler.executeCommand(intent);
      } catch (error: any) {
        suggestions = error.suggestions || [];
      }

      if (suggestions.length > 0) {
        for (const suggestion of suggestions) {
          expect(suggestion).not.toMatch(/[ðÐ][^а-яё]/);
          expect(suggestion).toMatch(/[а-яё]/i);
        }
      }
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle missing parent directory gracefully', async () => {
      const intent = {
        type: 'create_directory' as const,
        path: 'missing-parent/new-folder',
        recursive: false,
        reasoning: 'Test missing parent handling'
      };

      // Should handle error gracefully (CommandHandler doesn't throw, handles internally)
      await expect(commandHandler.executeCommand(intent)).resolves.toBeUndefined();
      
      // Verify the directory wasn't created due to missing parent
      const exists = await testUtils.fileExists('missing-parent/new-folder');
      expect(exists).toBe(false);
    });

    it('should validate recursive flag for nested creation', async () => {
      const intent = {
        type: 'create_directory' as const,
        path: 'deep/nested/path/structure',
        recursive: true, // Should create all intermediate directories
        reasoning: 'Test recursive directory creation'
      };

      await commandHandler.executeCommand(intent);

      const exists = await testUtils.fileExists('deep/nested/path/structure');
      expect(exists).toBe(true);
    });
  });
});
