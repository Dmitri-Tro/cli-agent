import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import { testUtils } from '../../setup';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Integration tests for modify_file operations
 * These tests verify the critical path that was broken in production
 */
describe('ModifyFile Integration Tests', () => {
  let commandHandler: CommandHandler;
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await testUtils.createTestWorkspace();
    commandHandler = new CommandHandler(testWorkspace);
  });

  afterEach(async () => {
    await testUtils.cleanTestWorkspace();
  });

  describe('modify_file backup creation', () => {
    it('should create backup before modifying file', async () => {
      // 1. Create original file
      const filePath = 'test.txt';
      const originalContent = 'привет мир';
      await testUtils.createTestFile(filePath, originalContent);

      // 2. Execute modify_file operation
      const modifyIntent = {
        type: 'modify_file' as const,
        path: filePath,
        search: 'привет',
        replace: 'здравствуй',
        global: false,
        reasoning: 'Test modify operation'
      };

      await commandHandler.executeCommand(modifyIntent);

      // 3. Verify file was modified
      const modifiedContent = await testUtils.readTestFile(filePath);
      expect(modifiedContent).toBe('здравствуй мир');

      // 4. Execute undo operation
      const undoIntent = {
        type: 'undo' as const,
        reasoning: 'Test undo after modify'
      };

      await commandHandler.executeCommand(undoIntent);

      // 5. Verify file was restored to original content
      const restoredContent = await testUtils.readTestFile(filePath);
      expect(restoredContent).toBe(originalContent);
    });

    it('should handle cyrillic content in modify operations', async () => {
      // Test with various cyrillic content
      const testCases = [
        {
          original: 'Тестовый файл с русским текстом',
          search: 'Тестовый',
          replace: 'Проверочный'
        },
        {
          original: 'файл.txt содержит данные',
          search: 'файл.txt',
          replace: 'документ.doc'
        },
        {
          original: 'многострочный\nтекст\nна русском',
          search: 'многострочный',
          replace: 'однострочный'
        }
      ];

      for (const [index, testCase] of testCases.entries()) {
        const filePath = `cyrillic-test-${index}.txt`;
        await testUtils.createTestFile(filePath, testCase.original);

        const modifyIntent = {
          type: 'modify_file' as const,
          path: filePath,
          search: testCase.search,
          replace: testCase.replace,
          global: false,
          reasoning: 'Test cyrillic modify'
        };

        await commandHandler.executeCommand(modifyIntent);

        // Verify modification
        const modifiedContent = await testUtils.readTestFile(filePath);
        const expectedContent = testCase.original.replace(testCase.search, testCase.replace);
        expect(modifiedContent).toBe(expectedContent);

        // Test undo
        const undoIntent = {
          type: 'undo' as const,
          reasoning: 'Test undo cyrillic'
        };

        await commandHandler.executeCommand(undoIntent);

        // Verify restoration
        const restoredContent = await testUtils.readTestFile(filePath);
        expect(restoredContent).toBe(testCase.original);
      }
    });

    it('should handle multiple modify operations with sequential undo', async () => {
      const filePath = 'sequential-test.txt';
      const originalContent = 'первая строка\nвторая строка\nтретья строка';
      await testUtils.createTestFile(filePath, originalContent);

      // First modification
      await commandHandler.executeCommand({
        type: 'modify_file' as const,
        path: filePath,
        search: 'первая',
        replace: 'изменённая',
        global: false,
        reasoning: 'First modify'
      });

      const afterFirst = await testUtils.readTestFile(filePath);
      expect(afterFirst).toBe('изменённая строка\nвторая строка\nтретья строка');

      // Second modification
      await commandHandler.executeCommand({
        type: 'modify_file' as const,
        path: filePath,
        search: 'вторая',
        replace: 'модифицированная',
        global: false,
        reasoning: 'Second modify'
      });

      const afterSecond = await testUtils.readTestFile(filePath);
      expect(afterSecond).toBe('изменённая строка\nмодифицированная строка\nтретья строка');

      // Undo second modification
      await commandHandler.executeCommand({
        type: 'undo' as const,
        reasoning: 'Undo second'
      });

      const afterFirstUndo = await testUtils.readTestFile(filePath);
      expect(afterFirstUndo).toBe(afterFirst);

      // Undo first modification
      await commandHandler.executeCommand({
        type: 'undo' as const,
        reasoning: 'Undo first'
      });

      const finalContent = await testUtils.readTestFile(filePath);
      expect(finalContent).toBe(originalContent);
    });
  });

  describe('modify_file error scenarios', () => {
    it('should handle modify operation on non-existent file gracefully', async () => {
      const modifyIntent = {
        type: 'modify_file' as const,
        path: 'non-existent.txt',
        search: 'test',
        replace: 'changed',
        global: false,
        reasoning: 'Test non-existent file'
      };

      // CommandHandler does not throw errors, it handles them internally
      await expect(commandHandler.executeCommand(modifyIntent)).resolves.toBeUndefined();
      
      // File should still not exist
      const fileExists = await testUtils.fileExists('non-existent.txt');
      expect(fileExists).toBe(false);
    });

    it('should handle empty search string gracefully', async () => {
      const filePath = 'empty-search-test.txt';
      await testUtils.createTestFile(filePath, 'test content');

      const modifyIntent = {
        type: 'modify_file' as const,
        path: filePath,
        search: '',
        replace: 'replacement',
        global: false,
        reasoning: 'Test empty search'
      };

      // Empty search string should rewrite entire file (valid behavior)
      await commandHandler.executeCommand(modifyIntent);
      
      // File should be completely replaced
      const content = await testUtils.readTestFile(filePath);
      expect(content).toBe('replacement');
    });
  });

  describe('integration with backup system', () => {
    it('should create proper backup metadata', async () => {
      const filePath = 'metadata-test.txt';
      const originalContent = 'метаданные тест';
      await testUtils.createTestFile(filePath, originalContent);

      // Get backup service to check metadata
      const backupService = (commandHandler as any).backupService;
      const initialStats = backupService.getStatistics();

      await commandHandler.executeCommand({
        type: 'modify_file' as const,
        path: filePath,
        search: 'метаданные',
        replace: 'данные',
        global: false,
        reasoning: 'Test metadata'
      });

      const finalStats = backupService.getStatistics();
      
      // Check that operation was recorded (either in undoableOperations or totalOperations)
      expect(finalStats.totalOperations).toBeGreaterThan(initialStats.totalOperations);
      
      // File should have been modified successfully
      const modifiedContent = await testUtils.readTestFile(filePath);
      expect(modifiedContent).toBe('данные тест');
    });
  });
});
