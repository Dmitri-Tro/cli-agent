import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Rename File and Directory Operations', () => {
  let commandHandler: CommandHandler;
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = path.join(__dirname, '..', '..', '..', 'workspace', `test-rename-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    commandHandler = new CommandHandler(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Successful rename operations', () => {
    test('should rename file with English name', async () => {
      // Create source file
      const sourceFile = path.join(testDir, 'source.txt');
      await fs.writeFile(sourceFile, 'test content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source.txt',
        newName: 'target.txt',
        overwrite: false,
        reasoning: 'Переименование файла source.txt в target.txt'
      };

      await commandHandler.executeCommand(intent);

      // Check that source file no longer exists
      await expect(fs.access(sourceFile)).rejects.toThrow();

      // Check that target file exists with correct content
      const targetFile = path.join(testDir, 'target.txt');
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('test content');
    });

    test('should rename file with Cyrillic name', async () => {
      // Create source file with Cyrillic name
      const sourceFile = path.join(testDir, 'тест.txt');
      await fs.writeFile(sourceFile, 'содержимое файла');

      const intent = {
        type: 'rename_file' as const,
        path: 'тест.txt',
        newName: 'новый.txt',
        overwrite: false,
        reasoning: 'Переименование файла тест.txt в новый.txt'
      };

      await commandHandler.executeCommand(intent);

      // Check that source file no longer exists
      await expect(fs.access(sourceFile)).rejects.toThrow();

      // Check that target file exists with correct content
      const targetFile = path.join(testDir, 'новый.txt');
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('содержимое файла');
    });

    test('should rename file with overwrite when target exists', async () => {
      // Create source and target files
      const sourceFile = path.join(testDir, 'source.txt');
      const targetFile = path.join(testDir, 'target.txt');
      await fs.writeFile(sourceFile, 'source content');
      await fs.writeFile(targetFile, 'target content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source.txt',
        newName: 'target.txt',
        overwrite: true,
        reasoning: 'Переименование файла с перезаписью'
      };

      await commandHandler.executeCommand(intent);

      // Check that source file no longer exists
      await expect(fs.access(sourceFile)).rejects.toThrow();

      // Check that target file has source content
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toBe('source content');
    });
  });

  describe('Error handling', () => {
    test('should handle non-existent source file', async () => {
      const intent = {
        type: 'rename_file' as const,
        path: 'nonexistent.txt',
        newName: 'target.txt',
        overwrite: false,
        reasoning: 'Переименование несуществующего файла'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // CommandHandler returns undefined on error
    });

    test('should handle target file exists without overwrite', async () => {
      // Create source and target files
      const sourceFile = path.join(testDir, 'source.txt');
      const targetFile = path.join(testDir, 'target.txt');
      await fs.writeFile(sourceFile, 'source content');
      await fs.writeFile(targetFile, 'target content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source.txt',
        newName: 'target.txt',
        overwrite: false,
        reasoning: 'Переименование без перезаписи'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // CommandHandler returns undefined on error

      // Both files should still exist
      expect(await fs.readFile(sourceFile, 'utf-8')).toBe('source content');
      expect(await fs.readFile(targetFile, 'utf-8')).toBe('target content');
    });

    test('should handle invalid characters in new name', async () => {
      // Create source file
      const sourceFile = path.join(testDir, 'source.txt');
      await fs.writeFile(sourceFile, 'test content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source.txt',
        newName: 'invalid<>name.txt', // Invalid characters for Windows
        overwrite: false,
        reasoning: 'Переименование с недопустимыми символами'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // CommandHandler returns undefined on error

      // Source file should still exist
      const content = await fs.readFile(sourceFile, 'utf-8');
      expect(content).toBe('test content');
    });
  });

  describe('Backup and Undo integration', () => {
    test('should create backup for rename operation', async () => {
      // Create source file
      const sourceFile = path.join(testDir, 'source.txt');
      await fs.writeFile(sourceFile, 'original content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source.txt',
        newName: 'renamed.txt',
        overwrite: false,
        reasoning: 'Переименование с созданием бэкапа'
      };

      await commandHandler.executeCommand(intent);

      // Check that file was renamed
      const renamedFile = path.join(testDir, 'renamed.txt');
      const content = await fs.readFile(renamedFile, 'utf-8');
      expect(content).toBe('original content');

      // Test undo functionality
      const undoIntent = {
        type: 'undo' as const,
        reasoning: 'Отмена переименования'
      };

      await commandHandler.executeCommand(undoIntent);

      // Original file should be restored
      const restoredContent = await fs.readFile(sourceFile, 'utf-8');
      expect(restoredContent).toBe('original content');

      // Renamed file should be gone
      await expect(fs.access(renamedFile)).rejects.toThrow();
    });
  });

  describe('Edge cases', () => {
    test('should handle renaming to same name', async () => {
      // Create source file
      const sourceFile = path.join(testDir, 'test.txt');
      await fs.writeFile(sourceFile, 'test content');

      const intent = {
        type: 'rename_file' as const,
        path: 'test.txt',
        newName: 'test.txt',
        overwrite: false,
        reasoning: 'Переименование в то же имя'
      };

      await commandHandler.executeCommand(intent);

      // File should still exist with same content
      const content = await fs.readFile(sourceFile, 'utf-8');
      expect(content).toBe('test content');
    });

    test('should handle file extension change', async () => {
      // Create source file
      const sourceFile = path.join(testDir, 'document.txt');
      await fs.writeFile(sourceFile, 'document content');

      const intent = {
        type: 'rename_file' as const,
        path: 'document.txt',
        newName: 'document.md',
        overwrite: false,
        reasoning: 'Изменение расширения файла'
      };

      await commandHandler.executeCommand(intent);

      // Check that file was renamed with new extension
      await expect(fs.access(sourceFile)).rejects.toThrow();

      const newFile = path.join(testDir, 'document.md');
      const content = await fs.readFile(newFile, 'utf-8');
      expect(content).toBe('document content');
    });
  });

  describe('Directory rename operations', () => {
    test('should rename directory with English name', async () => {
      // Create source directory with file inside
      const sourceDir = path.join(testDir, 'source-dir');
      await fs.mkdir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'test.txt'), 'content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source-dir',
        newName: 'target-dir',
        overwrite: false,
        reasoning: 'Переименование папки source-dir в target-dir'
      };

      await commandHandler.executeCommand(intent);

      // Check that source directory no longer exists
      await expect(fs.access(sourceDir)).rejects.toThrow();

      // Check that target directory exists with correct content
      const targetDir = path.join(testDir, 'target-dir');
      const content = await fs.readFile(path.join(targetDir, 'test.txt'), 'utf-8');
      expect(content).toBe('content');
    });

    test('should rename directory with Cyrillic name', async () => {
      // Create source directory with Cyrillic name
      const sourceDir = path.join(testDir, 'папка-источник');
      await fs.mkdir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'файл.txt'), 'содержимое');

      const intent = {
        type: 'rename_file' as const,
        path: 'папка-источник',
        newName: 'папка-цель',
        overwrite: false,
        reasoning: 'Переименование папки с кириллическими именами'
      };

      await commandHandler.executeCommand(intent);

      // Check that source directory no longer exists
      await expect(fs.access(sourceDir)).rejects.toThrow();

      // Check that target directory exists with correct content
      const targetDir = path.join(testDir, 'папка-цель');
      const content = await fs.readFile(path.join(targetDir, 'файл.txt'), 'utf-8');
      expect(content).toBe('содержимое');
    });

    test('should handle directory overwrite when target exists', async () => {
      // Create source and target directories
      const sourceDir = path.join(testDir, 'source-dir');
      const targetDir = path.join(testDir, 'target-dir');
      await fs.mkdir(sourceDir);
      await fs.mkdir(targetDir);
      await fs.writeFile(path.join(sourceDir, 'source.txt'), 'source content');
      await fs.writeFile(path.join(targetDir, 'target.txt'), 'target content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source-dir',
        newName: 'target-dir',
        overwrite: true,
        reasoning: 'Переименование папки с перезаписью'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // Windows doesn't allow directory overwrite via rename

      // Both directories should still exist since operation failed
      await expect(fs.access(sourceDir)).resolves.toBeUndefined();
      await expect(fs.access(targetDir)).resolves.toBeUndefined();
    });

    test('should handle non-existent source directory', async () => {
      const intent = {
        type: 'rename_file' as const,
        path: 'nonexistent-dir',
        newName: 'target-dir',
        overwrite: false,
        reasoning: 'Переименование несуществующей папки'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // CommandHandler returns undefined on error
    });

    test('should handle target directory exists without overwrite', async () => {
      // Create source and target directories
      const sourceDir = path.join(testDir, 'source-dir');
      const targetDir = path.join(testDir, 'target-dir');
      await fs.mkdir(sourceDir);
      await fs.mkdir(targetDir);

      const intent = {
        type: 'rename_file' as const,
        path: 'source-dir',
        newName: 'target-dir',
        overwrite: false,
        reasoning: 'Переименование папки без перезаписи'
      };

      const result = await commandHandler.executeCommand(intent);
      expect(result).toBeUndefined(); // CommandHandler returns undefined on error

      // Both directories should still exist
      await expect(fs.access(sourceDir)).resolves.toBeUndefined();
      await expect(fs.access(targetDir)).resolves.toBeUndefined();
    });

    test('should create backup for directory rename operation', async () => {
      // Create source directory with content
      const sourceDir = path.join(testDir, 'source-dir');
      await fs.mkdir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'content.txt'), 'original content');

      const intent = {
        type: 'rename_file' as const,
        path: 'source-dir',
        newName: 'renamed-dir',
        overwrite: false,
        reasoning: 'Переименование папки с созданием бэкапа'
      };

      await commandHandler.executeCommand(intent);

      // Check that directory was renamed
      const renamedDir = path.join(testDir, 'renamed-dir');
      const content = await fs.readFile(path.join(renamedDir, 'content.txt'), 'utf-8');
      expect(content).toBe('original content');

      // Test undo functionality
      const undoIntent = {
        type: 'undo' as const,
        reasoning: 'Отмена переименования папки'
      };

      await commandHandler.executeCommand(undoIntent);

      // Original directory should be restored
      const restoredContent = await fs.readFile(path.join(sourceDir, 'content.txt'), 'utf-8');
      expect(restoredContent).toBe('original content');

      // Renamed directory should be gone
      await expect(fs.access(renamedDir)).rejects.toThrow();
    });
  });
});
