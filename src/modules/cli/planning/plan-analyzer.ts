import * as fs from 'fs';
import * as path from 'path';
import type { CommandIntent } from '../../core';
// Type aliases for operations (simplified)
type CreateFileOperation = CommandIntent & { type: 'create_file'; path: string; content?: string; overwrite?: boolean };
type CreateDirectoryOperation = CommandIntent & { type: 'create_directory'; path: string };
type DeleteOperation = CommandIntent & { type: 'delete_file' | 'delete_directory'; path: string; recursive?: boolean };
type WriteFileOperation = CommandIntent & { type: 'write_file'; path: string; content: string };
type MoveOperation = CommandIntent & { type: 'move_file' | 'rename_file'; sourcePath?: string; destinationPath?: string; path?: string; newName?: string };
type CopyOperation = CommandIntent & { type: 'copy_file'; sourcePath: string; destinationPath: string };

/**
 * File operation impact analysis
 */
export interface OperationImpact {
  operation: CommandIntent;
  targetPath: string;
  impactType: 'create' | 'modify' | 'delete' | 'move' | 'read';
  conflicts: string[];
  warnings: string[];
  affectedFiles: string[];
  beforeState?: FileState;
  afterState?: FileState;
}

/**
 * File state information
 */
export interface FileState {
  exists: boolean;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: Date;
  children?: string[];
}

/**
 * Detailed plan analysis result
 */
export interface PlanAnalysis {
  operations: OperationImpact[];
  totalOperations: number;
  conflicts: string[];
  warnings: string[];
  filesystemBefore: Map<string, FileState>;
  filesystemAfter: Map<string, FileState>;
  summary: {
    creates: number;
    modifies: number;
    deletes: number;
    moves: number;
    reads: number;
  };
}

/**
 * Plan Analyzer - provides detailed analysis of planned operations
 * Analyzes impact, conflicts, and filesystem changes
 */
export class PlanAnalyzer {
  private readonly workingDirectory: string;

  constructor(workingDirectory?: string) {
    this.workingDirectory = workingDirectory || process.cwd();
  }

  /**
   * Analyze a plan with detailed impact assessment
   */
  async analyzePlan(operations: CommandIntent[]): Promise<PlanAnalysis> {
    const analysis: PlanAnalysis = {
      operations: [],
      totalOperations: operations.length,
      conflicts: [],
      warnings: [],
      filesystemBefore: new Map(),
      filesystemAfter: new Map(),
      summary: {
        creates: 0,
        modifies: 0,
        deletes: 0,
        moves: 0,
        reads: 0,
      },
    };

    // Capture current filesystem state
    await this.captureFilesystemState(analysis.filesystemBefore, operations);

    // Analyze each operation
    for (const operation of operations) {
      const impact = await this.analyzeOperation(operation, analysis);
      analysis.operations.push(impact);
      
      // Update summary
      analysis.summary[impact.impactType === 'create' ? 'creates' : 
                      impact.impactType === 'modify' ? 'modifies' :
                      impact.impactType === 'delete' ? 'deletes' :
                      impact.impactType === 'move' ? 'moves' : 'reads']++;
    }

    // Simulate filesystem state after operations
    await this.simulateAfterState(analysis);

    // Detect global conflicts
    this.detectGlobalConflicts(analysis);

    return analysis;
  }

  /**
   * Analyze single operation impact
   */
  private async analyzeOperation(operation: CommandIntent, _analysis: PlanAnalysis): Promise<OperationImpact> {
    const impact: OperationImpact = {
      operation,
      targetPath: this.extractTargetPath(operation),
      impactType: this.determineImpactType(operation),
      conflicts: [],
      warnings: [],
      affectedFiles: [],
    };

    // Get current state of target file/directory
    impact.beforeState = await this.getFileState(impact.targetPath);

    // Analyze specific operation impacts
    switch (operation.type) {
      case 'create_file':
        await this.analyzeCreateFile(impact, operation as CreateFileOperation);
        break;
      case 'create_directory':
        await this.analyzeCreateDirectory(impact, operation as CreateDirectoryOperation);
        break;
      case 'delete_file':
      case 'delete_directory':
        await this.analyzeDelete(impact, operation as DeleteOperation);
        break;
      case 'write_file':
        await this.analyzeWriteFile(impact, operation as WriteFileOperation);
        break;
      case 'move_file':
      case 'rename_file':
        await this.analyzeMove(impact, operation as MoveOperation);
        break;
      case 'copy_file':
        await this.analyzeCopy(impact, operation as CopyOperation);
        break;
      default:
        impact.impactType = 'read';
    }

    return impact;
  }

  /**
   * Analyze file creation impact
   */
  private async analyzeCreateFile(impact: OperationImpact, operation: CreateFileOperation): Promise<void> {
    const targetPath = this.resolvePath(impact.targetPath);
    
    if (impact.beforeState?.exists) {
      if (operation.overwrite) {
        impact.conflicts.push(`Файл будет перезаписан: ${impact.targetPath}`);
        impact.impactType = 'modify';
      } else {
        impact.conflicts.push(`Файл уже существует: ${impact.targetPath}`);
      }
    }

    // Check parent directory
    const parentDir = path.dirname(targetPath);
    const parentState = await this.getFileState(parentDir);
    
    if (!parentState.exists) {
      impact.warnings.push(`Родительская директория будет создана: ${path.dirname(impact.targetPath)}`);
    }

    impact.afterState = {
      exists: true,
      isDirectory: false,
      size: operation.content?.length || 0,
      modifiedTime: new Date(),
    };
  }

  /**
   * Analyze directory creation impact
   */
  private async analyzeCreateDirectory(impact: OperationImpact, _operation: CreateDirectoryOperation): Promise<void> {
    if (impact.beforeState?.exists) {
      if (impact.beforeState.isDirectory) {
        impact.warnings.push(`Директория уже существует: ${impact.targetPath}`);
      } else {
        impact.conflicts.push(`Файл с таким именем уже существует: ${impact.targetPath}`);
      }
    }

    impact.afterState = {
      exists: true,
      isDirectory: true,
      children: [],
      modifiedTime: new Date(),
    };
  }

  /**
   * Analyze delete operation impact
   */
  private async analyzeDelete(impact: OperationImpact, operation: DeleteOperation): Promise<void> {
    if (!impact.beforeState?.exists) {
      impact.warnings.push(`Файл не существует: ${impact.targetPath}`);
      return;
    }

    // Check for directory with contents
    if (impact.beforeState.isDirectory && impact.beforeState.children?.length) {
      if (operation.recursive) {
        impact.warnings.push(`Директория и все содержимое будет удалено: ${impact.targetPath} (${impact.beforeState.children.length} элементов)`);
        impact.affectedFiles = impact.beforeState.children.map(child => 
          path.join(impact.targetPath, child)
        );
      } else {
        impact.conflicts.push(`Директория не пуста: ${impact.targetPath}`);
      }
    }

    impact.afterState = {
      exists: false,
      isDirectory: false,
    };
  }

  /**
   * Analyze file write impact
   */
  private async analyzeWriteFile(impact: OperationImpact, operation: WriteFileOperation): Promise<void> {
    if (impact.beforeState?.exists) {
      impact.impactType = 'modify';
      impact.warnings.push(`Содержимое файла будет изменено: ${impact.targetPath}`);
    } else {
      impact.impactType = 'create';
    }

    impact.afterState = {
      exists: true,
      isDirectory: false,
      size: operation.content?.length || 0,
      modifiedTime: new Date(),
    };
  }

  /**
   * Analyze move/rename operation impact
   */
  private async analyzeMove(impact: OperationImpact, operation: MoveOperation): Promise<void> {
    const sourcePath = operation.sourcePath || impact.targetPath;
    const destPath = operation.destinationPath || operation.newName 
      ? path.join(path.dirname(impact.targetPath), operation.newName || '')
      : impact.targetPath;

    const sourceState = await this.getFileState(sourcePath);
    const destState = await this.getFileState(destPath);

    if (!sourceState.exists) {
      impact.conflicts.push(`Исходный файл не существует: ${sourcePath}`);
      return;
    }

    if (destState.exists && !operation.overwrite) {
      impact.conflicts.push(`Целевой файл уже существует: ${destPath}`);
    }

    impact.affectedFiles = [sourcePath, destPath];
    impact.afterState = { ...sourceState };
  }

  /**
   * Analyze copy operation impact
   */
  private async analyzeCopy(impact: OperationImpact, operation: CopyOperation): Promise<void> {
    const sourcePath = operation.sourcePath;
    const destPath = operation.destinationPath;

    const sourceState = await this.getFileState(sourcePath);
    const destState = await this.getFileState(destPath);

    if (!sourceState.exists) {
      impact.conflicts.push(`Исходный файл не существует: ${sourcePath}`);
      return;
    }

    if (destState.exists && !operation.overwrite) {
      impact.conflicts.push(`Целевой файл уже существует: ${destPath}`);
    }

    impact.affectedFiles = [sourcePath, destPath];
    impact.afterState = { ...sourceState };
  }

  /**
   * Get current file/directory state
   */
  private async getFileState(filePath: string): Promise<FileState> {
    const fullPath = this.resolvePath(filePath);
    
    try {
      const stats = await fs.promises.stat(fullPath);
      const state: FileState = {
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtime,
      };

      if (state.isDirectory) {
        try {
          const children = await fs.promises.readdir(fullPath);
          state.children = children;
        } catch {
          state.children = [];
        }
      }

      return state;
    } catch {
      return {
        exists: false,
        isDirectory: false,
      };
    }
  }

  /**
   * Capture current filesystem state for affected paths
   */
  private async captureFilesystemState(filesystemMap: Map<string, FileState>, operations: CommandIntent[]): Promise<void> {
    const pathsToCheck = new Set<string>();
    
    // Collect all paths that might be affected
    for (const operation of operations) {
      const targetPath = this.extractTargetPath(operation);
      pathsToCheck.add(targetPath);
      
      // Add parent directories
      let parent = path.dirname(targetPath);
      while (parent !== '.' && parent !== '/') {
        pathsToCheck.add(parent);
        parent = path.dirname(parent);
      }
    }

    // Capture state for each path
    for (const filePath of pathsToCheck) {
      const state = await this.getFileState(filePath);
      filesystemMap.set(filePath, state);
    }
  }

  /**
   * Simulate filesystem state after operations
   */
  private async simulateAfterState(analysis: PlanAnalysis): Promise<void> {
    // Copy current state as starting point
    for (const [path, state] of analysis.filesystemBefore) {
      analysis.filesystemAfter.set(path, { ...state });
    }

    // Apply each operation to simulated state
    for (const impact of analysis.operations) {
      if (impact.afterState) {
        analysis.filesystemAfter.set(impact.targetPath, impact.afterState);
      }
    }
  }

  /**
   * Detect global conflicts across operations
   */
  private detectGlobalConflicts(analysis: PlanAnalysis): void {
    const pathOperations = new Map<string, OperationImpact[]>();
    
    // Group operations by target path
    for (const impact of analysis.operations) {
      const existing = pathOperations.get(impact.targetPath) || [];
      existing.push(impact);
      pathOperations.set(impact.targetPath, existing);
    }

    // Check for conflicting operations on same path
    for (const [path, impacts] of pathOperations) {
      if (impacts.length > 1) {
        const operations = impacts.map(i => i.operation.type).join(', ');
        analysis.conflicts.push(`Множественные операции с одним путём ${path}: ${operations}`);
      }
    }

    // Collect all conflicts and warnings
    for (const impact of analysis.operations) {
      analysis.conflicts.push(...impact.conflicts);
      analysis.warnings.push(...impact.warnings);
    }
  }

  /**
   * Extract target path from operation
   */
  private extractTargetPath(operation: CommandIntent): string {
    const op = operation as Record<string, unknown>;
    return (op.path as string) || (op.destinationPath as string) || (op.sourcePath as string) || '';
  }

  /**
   * Determine impact type of operation
   */
  private determineImpactType(operation: CommandIntent): 'create' | 'modify' | 'delete' | 'move' | 'read' {
    switch (operation.type) {
      case 'create_file':
      case 'create_directory':
        return 'create';
      case 'write_file':
      case 'modify_file':
        return 'modify';
      case 'delete_file':
      case 'delete_directory':
        return 'delete';
      case 'move_file':
      case 'rename_file':
      case 'copy_file':
        return 'move';
      default:
        return 'read';
    }
  }

  /**
   * Resolve relative path to absolute
   */
  private resolvePath(filePath: string): string {
    return path.resolve(this.workingDirectory, filePath);
  }
}
