/**
 * Vitest Global Setup
 * Configures testing environment and global utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Test environment configuration
const TEST_WORKSPACE = path.resolve(process.cwd(), 'test-workspace');

// Global test utilities
export const testUtils = {
  workspace: TEST_WORKSPACE,
  
  /**
   * Create clean test workspace
   */
  async createTestWorkspace(): Promise<string> {
    await this.cleanTestWorkspace();
    await fs.mkdir(TEST_WORKSPACE, { recursive: true });
    return TEST_WORKSPACE;
  },
  
  /**
   * Clean test workspace
   */
  async cleanTestWorkspace(): Promise<void> {
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // Workspace doesn't exist - that's ok
    }
  },
  
  /**
   * Create test file with content
   */
  async createTestFile(relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(TEST_WORKSPACE, relativePath);
    const dir = path.dirname(fullPath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    
    return fullPath;
  },
  
  /**
   * Create test directory
   */
  async createTestDirectory(relativePath: string): Promise<string> {
    const fullPath = path.join(TEST_WORKSPACE, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
    return fullPath;
  },
  
  /**
   * Check if file exists in test workspace
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(TEST_WORKSPACE, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Read test file content
   */
  async readTestFile(relativePath: string): Promise<string> {
    const fullPath = path.join(TEST_WORKSPACE, relativePath);
    return fs.readFile(fullPath, 'utf-8');
  },
  
  /**
   * Get test file stats
   */
  async getTestFileStats(relativePath: string) {
    const fullPath = path.join(TEST_WORKSPACE, relativePath);
    return fs.stat(fullPath);
  }
};

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_API_KEY = 'test-key-fake';
  
  // Create test workspace
  await testUtils.createTestWorkspace();
  
  console.log('✅ Test environment ready');
});

// Global cleanup - runs once after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean test workspace
  await testUtils.cleanTestWorkspace();
  
  console.log('✅ Test environment cleaned');
});

// Before each test - ensure clean state
beforeEach(async () => {
  // Reset test workspace for each test with proper cleanup
  await testUtils.cleanTestWorkspace();
  await testUtils.createTestWorkspace();
});

// After each test - cleanup
afterEach(async () => {
  // Clean any test artifacts to prevent race conditions
  await testUtils.cleanTestWorkspace();
});

// Make test utilities globally available
declare global {
  const testUtils: typeof import('./setup').testUtils;
}

// @ts-ignore
globalThis.testUtils = testUtils;
