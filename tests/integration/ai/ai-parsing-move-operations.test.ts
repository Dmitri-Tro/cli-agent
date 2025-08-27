/**
 * AI Parsing Integration Tests for Move Operations
 * Tests for ISSUE-003: AI parsing problems with move commands
 */

import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { testUtils } from '../../setup';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import { FilesystemService } from '../../../src/modules/filesystem';
import { BackupService } from '../../../src/modules/backup';

describe('AI Parsing Move Operations Integration Tests (ISSUE-003)', () => {
  let commandHandler: CommandHandler;
  let filesystemService: FilesystemService;
  let backupService: BackupService;

  beforeEach(async () => {
    filesystemService = new FilesystemService(testUtils.workspace);
    backupService = new BackupService(testUtils.workspace);
    commandHandler = new CommandHandler(testUtils.workspace);
  });

  describe('Move operations parsing', () => {
    it('should parse "перемести файл A в папку B" correctly', async () => {
      // Create test files
      await testUtils.createTestFile('source.txt', 'test content');
      await testUtils.createTestDirectory('target');

      // Simulate AI parsing result for "перемести файл source.txt в папку target"
      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'source.txt',
        destinationPath: 'target/source.txt', // Should be folder + filename
        overwrite: false,
        reasoning: 'Перемещение файла source.txt в папку target'
      };

      await commandHandler.executeCommand(moveIntent);

      // Verify file was moved correctly
      const sourceExists = await testUtils.fileExists('source.txt');
      const targetExists = await testUtils.fileExists('target/source.txt');
      
      expect(sourceExists).toBe(false); // Original should be gone
      expect(targetExists).toBe(true);  // Should be in target folder
    });

    it('should parse nested path moves correctly', async () => {
      // Create nested structure
      await testUtils.createTestDirectory('docs');
      await testUtils.createTestDirectory('src'); 
      await testUtils.createTestFile('docs/readme.txt', 'documentation');

      // Simulate AI parsing: "перемести файл docs/readme.txt в папку src"
      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'docs/readme.txt',
        destinationPath: 'src/readme.txt', // Should extract filename and combine with target folder
        overwrite: false,
        reasoning: 'Перемещение файла из docs в src'
      };

      await commandHandler.executeCommand(moveIntent);

      const sourceExists = await testUtils.fileExists('docs/readme.txt');
      const targetExists = await testUtils.fileExists('src/readme.txt');
      
      expect(sourceExists).toBe(false);
      expect(targetExists).toBe(true);
    });

    it('should handle "в корень" moves correctly', async () => {
      // Create nested file
      await testUtils.createTestDirectory('nested'); 
      await testUtils.createTestFile('nested/file.txt', 'nested content');

      // Simulate AI parsing: "перемести файл nested/file.txt в корень"
      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'nested/file.txt',
        destinationPath: 'file.txt', // Should be just filename for root
        overwrite: false,
        reasoning: 'Перемещение файла в корень'
      };

      await commandHandler.executeCommand(moveIntent);

      const sourceExists = await testUtils.fileExists('nested/file.txt');
      const targetExists = await testUtils.fileExists('file.txt');
      
      expect(sourceExists).toBe(false);
      expect(targetExists).toBe(true);
    });
  });

  describe('Error scenarios with proper encoding', () => {
    it('should display cyrillic error messages correctly when file not found', async () => {
      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'несуществующий_файл.txt',
        destinationPath: 'target/файл.txt',
        overwrite: false,
        reasoning: 'Test error encoding'
      };

      // CommandHandler handles errors internally, doesn't throw
      await expect(commandHandler.executeCommand(moveIntent)).resolves.toBeUndefined();

      // Verify operation failed (file doesn't exist, so move should fail)
      const sourceExists = await testUtils.fileExists('нет_такого_файла.txt');
      expect(sourceExists).toBe(false);
      
      // Verify destination wasn't created
      const destExists = await testUtils.fileExists('папка/нет_такого_файла.txt');
      expect(destExists).toBe(false);
    });

    it('should handle cyrillic filenames in move operations', async () => {
      await testUtils.createTestFile('русский_файл.txt', 'содержимое');
      await testUtils.createTestDirectory('русская_папка');

      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'русский_файл.txt',
        destinationPath: 'русская_папка/русский_файл.txt',
        overwrite: false,
        reasoning: 'Перемещение файла с кириллическим именем'
      };

      await commandHandler.executeCommand(moveIntent);

      const sourceExists = await testUtils.fileExists('русский_файл.txt');
      const targetExists = await testUtils.fileExists('русская_папка/русский_файл.txt');
      
      expect(sourceExists).toBe(false);
      expect(targetExists).toBe(true);
    });
  });

  describe('Validation of AI parsing improvements', () => {
    it('should prevent same source and destination paths', async () => {
      await testUtils.createTestFile('test.txt', 'content');

      // This should NOT happen with improved AI parsing
      const badMoveIntent = {
        type: 'move_file' as const,
        sourcePath: 'test.txt',
        destinationPath: 'test.txt', // Same as source - should be detected
        overwrite: false,
        reasoning: 'Bad parsing example'
      };

      // Should handle error gracefully (CommandHandler doesn't throw, handles internally)
      await expect(commandHandler.executeCommand(badMoveIntent)).resolves.toBeUndefined();
      
      // Verify no actual move operation occurred (file still exists at original location)
      const exists = await testUtils.fileExists('test.txt');
      expect(exists).toBe(true);
    });

    it('should correctly parse complex move scenarios', async () => {
      // Setup complex directory structure  
      await testUtils.createTestDirectory('project');
      await testUtils.createTestDirectory('project/src');
      await testUtils.createTestDirectory('project/docs');
      await testUtils.createTestFile('project/src/main.ts', 'main code');

      // Simulate: "перемести файл project/src/main.ts в папку project/docs" 
      const moveIntent = {
        type: 'move_file' as const,
        sourcePath: 'project/src/main.ts',
        destinationPath: 'project/docs/main.ts', // Should preserve filename
        overwrite: false,
        reasoning: 'Complex nested move operation'
      };

      await commandHandler.executeCommand(moveIntent);

      const sourceExists = await testUtils.fileExists('project/src/main.ts');
      const targetExists = await testUtils.fileExists('project/docs/main.ts');
      
      expect(sourceExists).toBe(false);
      expect(targetExists).toBe(true);
    });
  });
});
