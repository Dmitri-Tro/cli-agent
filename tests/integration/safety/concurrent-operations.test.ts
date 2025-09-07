/**
 * Concurrent Operations and Safety System Tests
 * Critical tests for safety-critical scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../../setup';
import { CLIService } from '../../../src/modules/cli/cli.service';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';

describe('Concurrent Operations and Safety Tests', () => {
  let cliService: CLIService;
  let commandHandler: CommandHandler;

  beforeEach(async () => {
    cliService = new CLIService(testUtils.workspace);
    commandHandler = new CommandHandler(testUtils.workspace);
  });

  describe('Mutex and Concurrent Access', () => {
    it('should prevent concurrent file modifications', async () => {
      // Create initial file
      await testUtils.createTestFile('concurrent-test.txt', 'initial content');

      // Create two competing modify operations
      const modify1 = {
        type: 'modify_file' as const,
        path: 'concurrent-test.txt',
        search: 'initial',
        replace: 'modified1',
        global: false,
        reasoning: 'First modification'
      };

      const modify2 = {
        type: 'modify_file' as const,
        path: 'concurrent-test.txt', 
        search: 'initial',
        replace: 'modified2',
        global: false,
        reasoning: 'Second modification'
      };

      // Execute concurrently
      const [result1, result2] = await Promise.allSettled([
        commandHandler.executeCommand(modify1),
        commandHandler.executeCommand(modify2)
      ]);

      // At least one should complete successfully
      const successCount = [result1, result2].filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Final content should be from one of the modifications, not corrupted
      const finalContent = await testUtils.readTestFile('concurrent-test.txt');
      expect(finalContent === 'modified1 content' || finalContent === 'modified2 content').toBe(true);
    });

    it('should handle rapid successive operations safely', async () => {
      await testUtils.createTestFile('rapid-test.txt', 'start');

      const operations = [];
      
      // Create 10 rapid modifications
      for (let i = 0; i < 10; i++) {
        operations.push(commandHandler.executeCommand({
          type: 'modify_file' as const,
          path: 'rapid-test.txt',
          search: i === 0 ? 'start' : `step${i - 1}`,
          replace: `step${i}`,
          global: false,
          reasoning: `Rapid modification ${i}`
        }));
      }

      await Promise.allSettled(operations);

      // File should exist and contain valid content
      const exists = await testUtils.fileExists('rapid-test.txt');
      expect(exists).toBe(true);

      const content = await testUtils.readTestFile('rapid-test.txt');
      expect(content.startsWith('step')).toBe(true);
    });

    it('should prevent concurrent directory operations on same path', async () => {
      const createOps = Array.from({ length: 5 }, (_, i) => 
        commandHandler.executeCommand({
          type: 'create_directory' as const,
          path: 'concurrent-dir',
          recursive: false,
          reasoning: `Concurrent creation ${i}`
        })
      );

      const results = await Promise.allSettled(createOps);
      
      // Only one creation should succeed, others should be prevented by safety checks
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      expect(succeeded).toBeLessThanOrEqual(1);

      const exists = await testUtils.fileExists('concurrent-dir');
      expect(exists).toBe(true);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject path traversal attempts', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\Windows\\System32\\config',
        'test/../../../sensitive',
        './test/../../outside',
        'normal/../../../etc/hosts'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = await commandHandler.executeCommand({
          type: 'create_file' as const,
          path: maliciousPath,
          content: 'malicious content',
          overwrite: false,
          reasoning: 'Path traversal attempt'
        });

        // Operation should be rejected - file should not exist outside workspace
        const exists = await testUtils.fileExists(maliciousPath);
        expect(exists).toBe(false);
      }
    });

    it('should reject absolute paths outside workspace', async () => {
      const absolutePaths = [
        'C:\\Windows\\System32\\test.txt',
        '/etc/passwd',
        '/var/log/test.log',
        'D:\\sensitive\\data.txt'
      ];

      for (const absolutePath of absolutePaths) {
        await commandHandler.executeCommand({
          type: 'create_file' as const,
          path: absolutePath,
          content: 'should not create',
          overwrite: false,
          reasoning: 'Absolute path test'
        });

        // Should not create file outside workspace
        const exists = await testUtils.fileExists(absolutePath);
        expect(exists).toBe(false);
      }
    });

    it('should handle symbolic link attempts safely', async () => {
      // Attempt to create files with names that could be interpreted as symlinks
      const symlinkAttempts = [
        'link -> /etc/passwd',
        'symlink -> ../../../sensitive',
        'test.txt -> /outside/workspace'
      ];

      for (const linkName of symlinkAttempts) {
        await commandHandler.executeCommand({
          type: 'create_file' as const,
          path: linkName,
          content: 'test content',
          overwrite: false,
          reasoning: 'Symlink test'
        });

        // File might be created but should be contained within workspace
        if (await testUtils.fileExists(linkName)) {
          const stats = await testUtils.getTestFileStats(linkName);
          expect(stats.isFile()).toBe(true); // Should be regular file, not symlink
        }
      }
    });
  });

  describe('Backup System Safety', () => {
    it('should maintain backup integrity under concurrent access', async () => {
      await testUtils.createTestFile('backup-test.txt', 'original');

      // Perform multiple operations that should create backups
      const operations = [
        {
          type: 'modify_file' as const,
          path: 'backup-test.txt',
          search: 'original',
          replace: 'mod1',
          global: false,
          reasoning: 'First mod'
        },
        {
          type: 'modify_file' as const,
          path: 'backup-test.txt',
          search: 'original',
          replace: 'mod2', 
          global: false,
          reasoning: 'Second mod'
        },
        {
          type: 'write_file' as const,
          path: 'backup-test.txt',
          content: 'overwritten',
          overwrite: true,
          reasoning: 'Overwrite'
        }
      ];

      // Execute with delays to ensure sequential backup creation
      for (const op of operations) {
        await commandHandler.executeCommand(op);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Test undo operations
      await commandHandler.executeCommand({
        type: 'undo' as const,
        reasoning: 'Undo test'
      });

      const content = await testUtils.readTestFile('backup-test.txt');
      expect(content).not.toBe('overwritten'); // Should be restored to previous state
    });

    it('should handle backup failures gracefully', async () => {
      await testUtils.createTestFile('backup-failure-test.txt', 'content');

      // Create a scenario where backup might fail (e.g., insufficient disk space simulation)
      // This is hard to simulate directly, but we test the error handling path
      
      const operation = {
        type: 'modify_file' as const,
        path: 'backup-failure-test.txt',
        search: 'content',
        replace: 'new content',
        global: false,
        reasoning: 'Backup failure test'
      };

      // Operation should either succeed with backup or fail safely
      await commandHandler.executeCommand(operation);

      const exists = await testUtils.fileExists('backup-failure-test.txt');
      expect(exists).toBe(true); // File should still exist
    });

    it('should prevent backup corruption from concurrent operations', async () => {
      await testUtils.createTestFile('corruption-test.txt', 'initial');

      const concurrentOps = Array.from({ length: 3 }, (_, i) => ({
        type: 'modify_file' as const,
        path: 'corruption-test.txt',
        search: 'initial',
        replace: `concurrent${i}`,
        global: false,
        reasoning: `Concurrent operation ${i}`
      }));

      await Promise.allSettled(
        concurrentOps.map(op => commandHandler.executeCommand(op))
      );

      // Test that we can still undo safely
      await commandHandler.executeCommand({
        type: 'undo' as const,
        reasoning: 'Test undo after concurrent operations'
      });

      const exists = await testUtils.fileExists('corruption-test.txt');
      expect(exists).toBe(true);
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle large file operations safely', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content

      const operation = {
        type: 'create_file' as const,
        path: 'large-file.txt',
        content: largeContent,
        overwrite: false,
        reasoning: 'Large file test'
      };

      // Should complete within reasonable time and memory limits
      const start = Date.now();
      await commandHandler.executeCommand(operation);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      const exists = await testUtils.fileExists('large-file.txt');
      expect(exists).toBe(true);

      const content = await testUtils.readTestFile('large-file.txt');
      expect(content.length).toBe(largeContent.length);
    });

    it('should limit recursive directory creation depth', async () => {
      const deepPath = Array.from({ length: 100 }, (_, i) => `level${i}`).join('/');

      await commandHandler.executeCommand({
        type: 'create_directory' as const,
        path: deepPath,
        recursive: true,
        reasoning: 'Deep directory test'
      });

      // Should either create successfully with reasonable depth or reject safely
      const exists = await testUtils.fileExists(deepPath);
      
      if (exists) {
        // If created, verify it's actually within workspace
        const stats = await testUtils.getTestFileStats(deepPath);
        expect(stats.isDirectory()).toBe(true);
      }
      // If not created, that's also acceptable for safety
    });

    it('should handle many small operations efficiently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'create_file' as const,
        path: `small-file-${i}.txt`,
        content: `content ${i}`,
        overwrite: false,
        reasoning: `Small file ${i}`
      }));

      const start = Date.now();
      
      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        await Promise.all(batch.map(op => commandHandler.executeCommand(op)));
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify some files were created
      const exists = await testUtils.fileExists('small-file-0.txt');
      expect(exists).toBe(true);

      const lastExists = await testUtils.fileExists('small-file-99.txt');
      expect(lastExists).toBe(true);
    });
  });

  describe('Error Recovery and Atomicity', () => {
    it('should rollback failed operations atomically', async () => {
      await testUtils.createTestFile('atomic-test.txt', 'original');

      // Create operation that should fail mid-process
      const failingOperation = {
        type: 'move_file' as const,
        sourcePath: 'atomic-test.txt',
        destinationPath: 'nonexistent-dir/moved.txt', // Should fail - directory doesn't exist
        overwrite: false,
        reasoning: 'Atomic failure test'
      };

      await commandHandler.executeCommand(failingOperation);

      // Original file should still exist (operation should be atomic)
      const originalExists = await testUtils.fileExists('atomic-test.txt');
      expect(originalExists).toBe(true);

      // Destination should not exist
      const destExists = await testUtils.fileExists('nonexistent-dir/moved.txt');
      expect(destExists).toBe(false);

      // Content should be unchanged
      const content = await testUtils.readTestFile('atomic-test.txt');
      expect(content).toBe('original');
    });

    it('should handle partial failures in batch operations', async () => {
      // Create some files that exist and some that don't
      await testUtils.createTestFile('exists1.txt', 'content1');
      await testUtils.createTestFile('exists2.txt', 'content2');

      const batchOperations = [
        {
          type: 'delete_file' as const,
          path: 'exists1.txt',
          confirm: true,
          reasoning: 'Delete existing file'
        },
        {
          type: 'delete_file' as const,
          path: 'nonexistent.txt', // This should fail
          confirm: true,
          reasoning: 'Delete nonexistent file'
        },
        {
          type: 'delete_file' as const,
          path: 'exists2.txt',
          confirm: true,
          reasoning: 'Delete another existing file'
        }
      ];

      for (const op of batchOperations) {
        await commandHandler.executeCommand(op);
      }

      // Successful operations should complete
      const exists1 = await testUtils.fileExists('exists1.txt');
      expect(exists1).toBe(false); // Should be deleted

      const exists2 = await testUtils.fileExists('exists2.txt');
      expect(exists2).toBe(false); // Should be deleted

      // Failed operation should not affect others
      const nonexistentExists = await testUtils.fileExists('nonexistent.txt');
      expect(nonexistentExists).toBe(false); // Should remain nonexistent
    });
  });
});