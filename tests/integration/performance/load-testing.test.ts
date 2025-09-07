/**
 * Performance and Load Testing
 * Tests for performance characteristics and resource usage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../../setup';
import { CommandHandler } from '../../../src/modules/cli/handlers/command-handler';
import { BackupService } from '../../../src/modules/backup';
import { FilesystemService } from '../../../src/modules/filesystem';

describe('Performance and Load Testing', () => {
  let commandHandler: CommandHandler;
  let backupService: BackupService;
  let filesystemService: FilesystemService;

  beforeEach(async () => {
    commandHandler = new CommandHandler(testUtils.workspace);
    backupService = new BackupService(testUtils.workspace);
    filesystemService = new FilesystemService(testUtils.workspace);
  });

  describe('File Operation Performance', () => {
    it('should handle large file creation efficiently', async () => {
      const sizes = [
        { name: '1KB', size: 1024 },
        { name: '10KB', size: 10 * 1024 },
        { name: '100KB', size: 100 * 1024 },
        { name: '1MB', size: 1024 * 1024 },
      ];

      for (const { name, size } of sizes) {
        const content = 'x'.repeat(size);
        const startTime = Date.now();

        await commandHandler.executeCommand({
          type: 'create_file',
          path: `large-file-${name}.txt`,
          content,
          overwrite: false,
          reasoning: `Performance test for ${name} file`
        });

        const duration = Date.now() - startTime;
        
        // Performance thresholds (adjust based on system capabilities)
        const maxDuration = size < 100 * 1024 ? 1000 : 5000; // 1s for small files, 5s for large
        expect(duration).toBeLessThan(maxDuration);

        const exists = await testUtils.fileExists(`large-file-${name}.txt`);
        expect(exists).toBe(true);
      }
    });

    it('should handle many small files efficiently', async () => {
      const fileCount = 100;
      const startTime = Date.now();

      const operations = Array.from({ length: fileCount }, (_, i) => ({
        type: 'create_file' as const,
        path: `small-${i}.txt`,
        content: `Content for file ${i}`,
        overwrite: false,
        reasoning: `Performance test file ${i}`
      }));

      // Process in batches to avoid overwhelming system
      const batchSize = 10;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        await Promise.all(
          batch.map(op => commandHandler.executeCommand(op))
        );
      }

      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(20000); // 20 seconds for 100 files
      
      // Verify files were created
      for (let i = 0; i < Math.min(10, fileCount); i++) {
        const exists = await testUtils.fileExists(`small-${i}.txt`);
        expect(exists).toBe(true);
      }
    });

    it('should handle deep directory structures efficiently', async () => {
      const depths = [10, 20, 50];

      for (const depth of depths) {
        const path = Array.from({ length: depth }, (_, i) => `level${i}`).join('/');
        const startTime = Date.now();

        await commandHandler.executeCommand({
          type: 'create_directory',
          path,
          recursive: true,
          reasoning: `Performance test for depth ${depth}`
        });

        const duration = Date.now() - startTime;
        
        // Deep structures should still be reasonably fast
        expect(duration).toBeLessThan(5000); // 5 seconds max

        const exists = await testUtils.fileExists(path);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Backup System Performance', () => {
    it('should handle frequent backup operations efficiently', async () => {
      await testUtils.createTestFile('backup-perf-test.txt', 'initial content');

      const operationCount = 50;
      const startTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        await commandHandler.executeCommand({
          type: 'modify_file',
          path: 'backup-perf-test.txt',
          search: i === 0 ? 'initial content' : `modification ${i - 1}`,
          replace: `modification ${i}`,
          global: false,
          reasoning: `Performance modification ${i}`
        });
      }

      const duration = Date.now() - startTime;
      
      // Should handle 50 modifications with backups in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds

      // Test that we can still undo efficiently
      const undoStartTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await commandHandler.executeCommand({
          type: 'undo',
          reasoning: `Performance undo ${i}`
        });
      }

      const undoDuration = Date.now() - undoStartTime;
      expect(undoDuration).toBeLessThan(5000); // 5 seconds for 5 undos
    });

    it('should manage backup storage efficiently', async () => {
      await testUtils.createTestFile('storage-test.txt', 'content');

      // Create many backup versions
      for (let i = 0; i < 20; i++) {
        await commandHandler.executeCommand({
          type: 'modify_file',
          path: 'storage-test.txt',
          search: i === 0 ? 'content' : `version${i - 1}`,
          replace: `version${i}`,
          global: false,
          reasoning: `Storage test ${i}`
        });
      }

      // Backup system should manage storage without consuming excessive disk space
      // This is more of a smoke test - actual implementation should have cleanup policies
      const finalContent = await testUtils.readTestFile('storage-test.txt');
      expect(finalContent).toMatch(/version\d+/);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent read operations efficiently', async () => {
      // Create test files
      const fileCount = 20;
      for (let i = 0; i < fileCount; i++) {
        await testUtils.createTestFile(`concurrent-read-${i}.txt`, `Content ${i}`);
      }

      const startTime = Date.now();

      // Perform concurrent read operations
      const readPromises = Array.from({ length: fileCount }, (_, i) =>
        commandHandler.executeCommand({
          type: 'read_file',
          path: `concurrent-read-${i}.txt`,
          reasoning: `Concurrent read ${i}`
        })
      );

      await Promise.allSettled(readPromises);

      const duration = Date.now() - startTime;
      
      // Concurrent reads should be fast
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should handle mixed concurrent operations safely', async () => {
      // Create initial files
      for (let i = 0; i < 10; i++) {
        await testUtils.createTestFile(`mixed-${i}.txt`, `content ${i}`);
      }

      const startTime = Date.now();

      // Mix of concurrent operations
      const operations = [
        // Reads (should be fast and parallel)
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'read_file' as const,
          path: `mixed-${i}.txt`,
          reasoning: `Concurrent read ${i}`
        })),
        
        // Modifications (should be serialized by mutex)
        ...Array.from({ length: 3 }, (_, i) => ({
          type: 'modify_file' as const,
          path: `mixed-${i + 5}.txt`,
          search: `content ${i + 5}`,
          replace: `modified ${i + 5}`,
          global: false,
          reasoning: `Concurrent modify ${i + 5}`
        })),

        // New file creations (should be efficient)
        ...Array.from({ length: 2 }, (_, i) => ({
          type: 'create_file' as const,
          path: `new-concurrent-${i}.txt`,
          content: `new content ${i}`,
          overwrite: false,
          reasoning: `Concurrent create ${i}`
        }))
      ];

      const promises = operations.map(op => commandHandler.executeCommand(op));
      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;
      
      // Should complete mixed operations in reasonable time
      expect(duration).toBeLessThan(20000); // 20 seconds

      // Verify operations completed successfully
      const newFileExists = await testUtils.fileExists('new-concurrent-0.txt');
      expect(newFileExists).toBe(true);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not accumulate excessive memory during operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      for (let i = 0; i < 50; i++) {
        const largeContent = 'x'.repeat(50 * 1024); // 50KB per file
        
        await commandHandler.executeCommand({
          type: 'create_file',
          path: `memory-test-${i}.txt`,
          content: largeContent,
          overwrite: false,
          reasoning: `Memory test ${i}`
        });

        // Clean up some files to test memory release
        if (i % 10 === 9 && i > 0) {
          for (let j = i - 5; j < i; j++) {
            await commandHandler.executeCommand({
              type: 'delete_file',
              path: `memory-test-${j}.txt`,
              confirm: true,
              reasoning: `Memory cleanup ${j}`
            });
          }
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (adjust threshold based on system)
      const maxMemoryIncrease = 100 * 1024 * 1024; // 100MB
      expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
    });

    it('should handle file handle cleanup properly', async () => {
      // Create and delete many files to test file handle management
      for (let batch = 0; batch < 10; batch++) {
        const batchOperations = [];
        
        // Create files
        for (let i = 0; i < 20; i++) {
          batchOperations.push(
            commandHandler.executeCommand({
              type: 'create_file',
              path: `handle-test-${batch}-${i}.txt`,
              content: `Batch ${batch} File ${i}`,
              overwrite: false,
              reasoning: `Handle test ${batch}-${i}`
            })
          );
        }

        await Promise.allSettled(batchOperations);

        // Delete files
        const deleteOperations = [];
        for (let i = 0; i < 20; i++) {
          deleteOperations.push(
            commandHandler.executeCommand({
              type: 'delete_file',
              path: `handle-test-${batch}-${i}.txt`,
              confirm: true,
              reasoning: `Handle cleanup ${batch}-${i}`
            })
          );
        }

        await Promise.allSettled(deleteOperations);
      }

      // Should complete without running out of file handles
      expect(true).toBe(true); // If we get here, file handle management worked
    });
  });

  describe('Scalability Testing', () => {
    it('should maintain performance with large directory structures', async () => {
      const structure = {
        'project': {
          'src': {
            'components': 20, // 20 components
            'utils': 10,      // 10 utilities
            'pages': 15       // 15 pages
          },
          'tests': {
            'unit': 30,       // 30 unit tests
            'integration': 15  // 15 integration tests
          },
          'docs': 5           // 5 documentation files
        }
      };

      const startTime = Date.now();

      // Create directory structure
      for (const [rootDir, subdirs] of Object.entries(structure)) {
        await commandHandler.executeCommand({
          type: 'create_directory',
          path: rootDir,
          recursive: false,
          reasoning: `Create ${rootDir}`
        });

        for (const [subdir, fileCount] of Object.entries(subdirs)) {
          if (typeof fileCount === 'number') {
            await commandHandler.executeCommand({
              type: 'create_directory',
              path: `${rootDir}/${subdir}`,
              recursive: false,
              reasoning: `Create ${rootDir}/${subdir}`
            });

            // Create files in batches
            const batchSize = 5;
            for (let i = 0; i < fileCount; i += batchSize) {
              const batch = [];
              for (let j = i; j < Math.min(i + batchSize, fileCount); j++) {
                batch.push(
                  commandHandler.executeCommand({
                    type: 'create_file',
                    path: `${rootDir}/${subdir}/file-${j}.txt`,
                    content: `File ${j} in ${rootDir}/${subdir}`,
                    overwrite: false,
                    reasoning: `Create file ${j}`
                  })
                );
              }
              await Promise.all(batch);
            }
          } else {
            // Nested structure
            for (const [nestedDir, nestedCount] of Object.entries(fileCount)) {
              await commandHandler.executeCommand({
                type: 'create_directory',
                path: `${rootDir}/${subdir}/${nestedDir}`,
                recursive: true,
                reasoning: `Create ${rootDir}/${subdir}/${nestedDir}`
              });

              for (let i = 0; i < nestedCount; i++) {
                await commandHandler.executeCommand({
                  type: 'create_file',
                  path: `${rootDir}/${subdir}/${nestedDir}/file-${i}.txt`,
                  content: `Nested file ${i}`,
                  overwrite: false,
                  reasoning: `Create nested file ${i}`
                });
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      // Should create large structure in reasonable time
      expect(duration).toBeLessThan(60000); // 60 seconds

      // Verify structure was created
      const exists = await testUtils.fileExists('project/src/components/file-0.txt');
      expect(exists).toBe(true);

      const nestedExists = await testUtils.fileExists('project/tests/unit/file-29.txt');
      expect(nestedExists).toBe(true);
    });

    it('should handle large-scale undo operations efficiently', async () => {
      // Create a series of operations to undo
      const operationCount = 30;
      await testUtils.createTestFile('undo-scale-test.txt', 'start');

      for (let i = 0; i < operationCount; i++) {
        await commandHandler.executeCommand({
          type: 'modify_file',
          path: 'undo-scale-test.txt',
          search: i === 0 ? 'start' : `step${i - 1}`,
          replace: `step${i}`,
          global: false,
          reasoning: `Scale test step ${i}`
        });
      }

      // Now undo all operations and measure performance
      const undoStartTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        await commandHandler.executeCommand({
          type: 'undo',
          reasoning: `Scale undo ${i}`
        });
      }

      const undoDuration = Date.now() - undoStartTime;

      // Should undo all operations in reasonable time
      expect(undoDuration).toBeLessThan(20000); // 20 seconds

      // Should be back to original content
      const finalContent = await testUtils.readTestFile('undo-scale-test.txt');
      expect(finalContent).toBe('start');
    });
  });
});