import { FileOperations } from './operations/file-operations';
import { DirectoryOperations } from './operations/directory-operations';
import { FileManipulationOperations } from './operations/file-manipulation-operations';
import type {
  OperationResult,
  CreateFileOptions,
  WriteFileMode,
  CreateDirectoryOptions,
  FileStats,
} from './types';

/**
 * Filesystem Service - unified interface to all filesystem operations
 * Acts as a facade for the filesystem module
 */
export class FilesystemService {
  private readonly fileOps: FileOperations;
  private readonly dirOps: DirectoryOperations;
  private readonly manipOps: FileManipulationOperations;

  constructor(workingDirectory?: string) {
    this.fileOps = new FileOperations(workingDirectory);
    this.dirOps = new DirectoryOperations(workingDirectory);
    this.manipOps = new FileManipulationOperations(workingDirectory);
  }

  // File operations
  async createFile(
    targetPath: string,
    content = '',
    options: CreateFileOptions = {}
  ): Promise<OperationResult> {
    return this.fileOps.createFile(targetPath, content, options);
  }

  async writeFile(
    targetPath: string,
    content: string,
    mode: WriteFileMode = 'overwrite'
  ): Promise<OperationResult> {
    return this.fileOps.writeFile(targetPath, content, mode);
  }

  async readFile(targetPath: string, lines?: number, fromLine?: number): Promise<OperationResult> {
    return this.fileOps.readFile(targetPath, lines, fromLine);
  }

  async deleteFile(targetPath: string): Promise<OperationResult> {
    return this.fileOps.deleteFile(targetPath);
  }

  async modifyFile(
    targetPath: string,
    search: string,
    replace: string,
    global = false
  ): Promise<OperationResult> {
    return this.fileOps.modifyFile(targetPath, search, replace, global);
  }

  async exists(targetPath: string): Promise<boolean> {
    return this.fileOps.exists(targetPath);
  }

  async getStats(
    targetPath: string
  ): Promise<{ success: boolean; stats?: FileStats; error?: string }> {
    return this.fileOps.getStats(targetPath);
  }

  // Directory operations
  async createDirectory(
    targetPath: string,
    options: CreateDirectoryOptions = {}
  ): Promise<OperationResult> {
    return this.dirOps.createDirectory(targetPath, options);
  }

  async deleteDirectory(targetPath: string, recursive = false): Promise<OperationResult> {
    return this.dirOps.deleteDirectory(targetPath, recursive);
  }

  async listDirectory(targetPath: string = '.', detailed = false): Promise<OperationResult> {
    return this.dirOps.listDirectory(targetPath, detailed);
  }

  // File manipulation operations
  async copyFile(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    return this.manipOps.copyFile(sourcePath, destinationPath, overwrite);
  }

  async moveFile(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    return this.manipOps.moveFile(sourcePath, destinationPath, overwrite);
  }

  async renameFile(
    targetPath: string,
    newName: string,
    overwrite = false
  ): Promise<OperationResult> {
    return this.manipOps.renameFile(targetPath, newName, overwrite);
  }

  async copyDirectory(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    return this.manipOps.copyDirectory(sourcePath, destinationPath, overwrite);
  }
}
