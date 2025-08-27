import { describe, it, expect } from 'vitest';

/**
 * Simplified Integration Tests
 * These tests verify that the integration layer components can be imported and instantiated
 * without running the full application which would call process.exit
 */
describe('CLI Integration - Simplified', () => {
  describe('Module Imports', () => {
    it('should be able to import CLI service', async () => {
      const { CLIService } = await import('../../../src/modules/cli');
      expect(CLIService).toBeDefined();
      expect(typeof CLIService).toBe('function');
    });
    
    it('should be able to import command handler', async () => {
      const { CommandHandler } = await import('../../../src/modules/cli/handlers/command-handler');
      expect(CommandHandler).toBeDefined();
      expect(typeof CommandHandler).toBe('function');
    });
    
    it('should be able to import filesystem service', async () => {
      const { FilesystemService } = await import('../../../src/modules/filesystem');
      expect(FilesystemService).toBeDefined();
      expect(typeof FilesystemService).toBe('function');
    });
    
    it('should be able to import backup service', async () => {
      const { BackupService } = await import('../../../src/modules/backup');
      expect(BackupService).toBeDefined();
      expect(typeof BackupService).toBe('function');
    });
  });

  describe('Service Integration', () => {
    it('should create CLI service with filesystem and backup services', async () => {
      const { CLIService } = await import('../../../src/modules/cli');
      const { FilesystemService } = await import('../../../src/modules/filesystem');
      const { BackupService } = await import('../../../src/modules/backup');
      
      const filesystemService = new FilesystemService('/test');
      const backupService = new BackupService('/test');
      const cliService = new CLIService('/test');
      
      expect(filesystemService).toBeInstanceOf(FilesystemService);
      expect(backupService).toBeInstanceOf(BackupService);
      expect(cliService).toBeInstanceOf(CLIService);
    });
    
    it('should verify service method interfaces', async () => {
      const { CLIService } = await import('../../../src/modules/cli');
      const cliService = new CLIService('/test');
      
      // Check that core methods exist
      expect(typeof cliService.executeCommand).toBe('function');
      expect(typeof cliService.initialize).toBe('function');
      expect(typeof cliService.setDryRunMode).toBe('function');
      expect(typeof cliService.setExplainMode).toBe('function');
      expect(typeof cliService.setDiscussMode).toBe('function');
    });
  });

  describe('Schema Integration', () => {
    it('should be able to import schemas', async () => {
      const { CommandIntentSchema } = await import('../../../src/modules/core/schemas/intent-schemas');
      expect(CommandIntentSchema).toBeDefined();
      expect(typeof CommandIntentSchema.safeParse).toBe('function');
    });
    
    it('should be able to use schemas for validation', async () => {
      const { CommandIntentSchema } = await import('../../../src/modules/core/schemas/intent-schemas');
      const testIntent = { type: 'help', reasoning: 'test' };
      const result = CommandIntentSchema.safeParse(testIntent);
      expect(result.success).toBe(true);
    });
  });
});
