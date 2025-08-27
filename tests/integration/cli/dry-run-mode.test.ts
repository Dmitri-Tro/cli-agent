import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { CLIService } from '../../../src/modules/cli/cli.service';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Dry-Run Mode Operations', () => {
  let cliService: CLIService;
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(__dirname, '..', '..', '..', 'workspace', `test-dry-run-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    cliService = new CLIService(testDir);
    await cliService.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Dry-run mode functionality', () => {
    test('should add operations to plan when dry-run mode is enabled', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);
      expect(cliService.getModes().dryRun).toBe(true);

      // Create test intent
      const createFileIntent = {
        type: 'create_file' as const,
        path: 'test.txt',
        content: 'test content',
        overwrite: false,
        reasoning: 'Создание тестового файла'
      };

      // Execute command (should add to plan, not execute)
      await cliService.executeCommand(createFileIntent);

      // Check that plan has one operation
      expect(cliService.isPlanEmpty()).toBe(false);

      // Show plan
      await cliService.showPlan();
    });

    test('should execute operations when go command is used', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add operations to plan
      const createFileIntent = {
        type: 'create_file' as const,
        path: 'test.txt',
        content: 'test content',
        overwrite: false,
        reasoning: 'Создание тестового файла'
      };

      const createDirIntent = {
        type: 'create_directory' as const,
        path: 'test-dir',
        recursive: false,
        reasoning: 'Создание тестовой папки'
      };

      // Add operations to plan
      await cliService.executeCommand(createFileIntent);
      await cliService.executeCommand(createDirIntent);

      // Verify operations are in plan
      expect(cliService.isPlanEmpty()).toBe(false);

      // Execute plan
      await cliService.executePlannedOperations();

      // Verify operations were executed
      const testFile = path.join(testDir, 'test.txt');
      const testDirPath = path.join(testDir, 'test-dir');
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe('test content');

      const dirExists = await fs.access(testDirPath).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Verify plan is now empty
      expect(cliService.isPlanEmpty()).toBe(true);
    });

    test('should clear plan when clear command is used', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add operations to plan
      const createFileIntent = {
        type: 'create_file' as const,
        path: 'test.txt',
        content: 'test content',
        overwrite: false,
        reasoning: 'Создание тестового файла'
      };

      await cliService.executeCommand(createFileIntent);
      expect(cliService.isPlanEmpty()).toBe(false);

      // Clear plan
      const clearedCount = cliService.clearPlan();
      expect(clearedCount).toBe(1);
      expect(cliService.isPlanEmpty()).toBe(true);
    });

    test('should handle mixed operations in plan', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add various operations to plan
      const operations = [
        {
          type: 'create_file' as const,
          path: 'file1.txt',
          content: 'content 1',
          overwrite: false,
          reasoning: 'Создание первого файла'
        },
        {
          type: 'create_directory' as const,
          path: 'dir1',
          recursive: false,
          reasoning: 'Создание первой папки'
        },
        {
          type: 'write_file' as const,
          path: 'file2.txt',
          content: 'content 2',
          overwrite: true,
          reasoning: 'Запись во второй файл'
        }
      ];

      // Add all operations to plan
      for (const op of operations) {
        await cliService.executeCommand(op);
      }

      // Verify plan has all operations
      expect(cliService.isPlanEmpty()).toBe(false);

      // Execute plan
      await cliService.executePlannedOperations();

      // Verify all operations were executed
      const file1Content = await fs.readFile(path.join(testDir, 'file1.txt'), 'utf-8');
      expect(file1Content).toBe('content 1');

      const file2Content = await fs.readFile(path.join(testDir, 'file2.txt'), 'utf-8');
      expect(file2Content).toBe('content 2');

      const dir1Exists = await fs.access(path.join(testDir, 'dir1')).then(() => true).catch(() => false);
      expect(dir1Exists).toBe(true);

      // Verify plan is now empty
      expect(cliService.isPlanEmpty()).toBe(true);
    });

    test('should handle plan execution with errors gracefully', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add operations to plan (one valid, one invalid)
      const validOp = {
        type: 'create_file' as const,
        path: 'valid.txt',
        content: 'valid content',
        overwrite: false,
        reasoning: 'Создание валидного файла'
      };

      const invalidOp = {
        type: 'delete_file' as const,
        path: 'nonexistent.txt',
        confirm: true,
        reasoning: 'Удаление несуществующего файла'
      };

      // Add operations to plan
      await cliService.executeCommand(validOp);
      await cliService.executeCommand(invalidOp);

      // Execute plan (should handle errors gracefully)
      await cliService.executePlannedOperations();

      // Verify valid operation was executed
      const validFileContent = await fs.readFile(path.join(testDir, 'valid.txt'), 'utf-8');
      expect(validFileContent).toBe('valid content');

      // Verify plan is now empty (even after errors)
      expect(cliService.isPlanEmpty()).toBe(true);
    });

    test('should toggle dry-run mode correctly', async () => {
      // Initially dry-run should be disabled
      expect(cliService.getModes().dryRun).toBe(false);

      // Enable dry-run mode
      cliService.setDryRunMode(true);
      expect(cliService.getModes().dryRun).toBe(true);

      // Disable dry-run mode
      cliService.setDryRunMode(false);
      expect(cliService.getModes().dryRun).toBe(false);
    });

    test('should execute operations immediately when dry-run mode is disabled', async () => {
      // Ensure dry-run mode is disabled
      cliService.setDryRunMode(false);

      // Create test intent
      const createFileIntent = {
        type: 'create_file' as const,
        path: 'immediate.txt',
        content: 'immediate content',
        overwrite: false,
        reasoning: 'Немедленное создание файла'
      };

      // Execute command (should execute immediately)
      await cliService.executeCommand(createFileIntent);

      // Verify file was created immediately
      const fileContent = await fs.readFile(path.join(testDir, 'immediate.txt'), 'utf-8');
      expect(fileContent).toBe('immediate content');

      // Verify plan is empty (no operations were added to plan)
      expect(cliService.isPlanEmpty()).toBe(true);
    });
  });

  describe('Plan management commands', () => {
    test('should show empty plan correctly', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Show empty plan
      await cliService.showPlan();
      expect(cliService.isPlanEmpty()).toBe(true);
    });

    test('should show plan with operations correctly', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add operations to plan
      const createFileIntent = {
        type: 'create_file' as const,
        path: 'test.txt',
        content: 'test content',
        overwrite: false,
        reasoning: 'Создание тестового файла'
      };

      await cliService.executeCommand(createFileIntent);

      // Show plan
      await cliService.showPlan();
      expect(cliService.isPlanEmpty()).toBe(false);
    });

    test('should clear plan and return correct count', async () => {
      // Enable dry-run mode
      cliService.setDryRunMode(true);

      // Add multiple operations to plan
      const operations = [
        {
          type: 'create_file' as const,
          path: 'file1.txt',
          content: 'content 1',
          overwrite: false,
          reasoning: 'Создание первого файла'
        },
        {
          type: 'create_file' as const,
          path: 'file2.txt',
          content: 'content 2',
          overwrite: false,
          reasoning: 'Создание второго файла'
        }
      ];

      // Add operations to plan
      for (const op of operations) {
        await cliService.executeCommand(op);
      }

      // Clear plan and verify count
      const clearedCount = cliService.clearPlan();
      expect(clearedCount).toBe(2);
      expect(cliService.isPlanEmpty()).toBe(true);
    });
  });
});
