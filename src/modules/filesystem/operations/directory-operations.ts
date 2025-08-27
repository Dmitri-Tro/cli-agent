import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { PathValidator } from '../validation/path-validator';


import type { OperationResult, CreateDirectoryOptions } from '../types';

/**
 * Directory Operations Service - handles all directory-related operations
 */
export class DirectoryOperations {
  private readonly pathValidator: PathValidator;

  constructor(workingDirectory?: string) {
    this.pathValidator = new PathValidator(workingDirectory);
  }

  /**
   * Create a directory
   */
  async createDirectory(
    targetPath: string,
    options: CreateDirectoryOptions = {}
  ): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(
      targetPath,
      'создание директории'
    );
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;
    const { recursive = true } = options;

    try {
      // Check if something already exists at this path
      if (existsSync(resolvedPath)) {
        const stats = await fs.stat(resolvedPath);
        
        if (stats.isDirectory()) {
          return {
            success: false,
            message: 'Директория уже существует',
            path: targetPath,
            error: `Директория '${targetPath}' уже существует`,
          };
        } else if (stats.isFile()) {
          return {
            success: false,
            message: 'Файл с таким именем уже существует',
            path: targetPath,
            error: `Файл '${targetPath}' уже существует. Нельзя создать директорию с таким же именем.`,
          };
        } else {
          return {
            success: false,
            message: 'Объект с таким именем уже существует',
            path: targetPath,
            error: `Объект '${targetPath}' уже существует и не является ни файлом, ни директорией`,
          };
        }
      }

      await fs.mkdir(resolvedPath, { recursive });

      return {
        success: true,
        message: `Директория '${targetPath}' успешно создана`,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось создать директорию',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a directory
   */
  async deleteDirectory(targetPath: string, recursive = false): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(
      targetPath,
      'удаление директории'
    );
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: 'Директория не существует',
          path: targetPath,
          error: `Директория '${targetPath}' не найдена`,
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: 'Это файл, а не директория',
          path: targetPath,
          error: `'${targetPath}' является файлом. Используйте команду удаления файла.`,
        };
      }

      // Check if directory is empty before deletion
      if (!recursive) {
        const contents = await fs.readdir(resolvedPath);
        if (contents.length > 0) {
          return {
            success: false,
            message: 'Директория не пуста',
            path: targetPath,
            error: `Директория '${targetPath}' содержит файлы. Используйте recursive флаг для удаления.`,
          };
        }
        
        // Delete empty directory
        await fs.rmdir(resolvedPath);
      } else {
        // Delete directory recursively
        await fs.rm(resolvedPath, { recursive: true, force: true });
      }

      return {
        success: true,
        message: `Директория '${targetPath}' успешно удалена`,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось удалить директорию',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(targetPath: string = '.', detailed = false): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(
      targetPath,
      'просмотр содержимого директории'
    );
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: 'Директория не существует',
          path: targetPath,
          error: `Директория '${targetPath}' не найдена`,
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: 'Указанный путь не является директорией',
          path: targetPath,
          error: `'${targetPath}' не является директорией`,
        };
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

      if (entries.length === 0) {
        return {
          success: true,
          message: `Директория '${targetPath}' пуста`,
          path: targetPath,
        };
      }

      let content = '';
      if (detailed) {
        content = `Содержимое директории '${targetPath}':\n`;
        for (const entry of entries) {
          const entryPath = path.join(resolvedPath, entry.name);
          const entryStats = await fs.stat(entryPath);
          const type = entry.isDirectory() ? 'DIR' : 'FILE';
          const size = entry.isFile() ? entryStats.size : '-';
          const modified = entryStats.mtime.toLocaleString();
          content += `  ${type.padEnd(4)} ${entry.name.padEnd(30)} ${String(size).padStart(10)} ${modified}\n`;
        }
      } else {
        const files = entries.filter(e => e.isFile()).map(e => e.name);
        const dirs = entries.filter(e => e.isDirectory()).map(e => e.name + '/');

        content = `Содержимое директории '${targetPath}':\n`;
        if (dirs.length > 0) {
          content += `Папки: ${dirs.join(', ')}\n`;
        }
        if (files.length > 0) {
          content += `Файлы: ${files.join(', ')}\n`;
        }
      }

      return {
        success: true,
        message: content.trim(),
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось прочитать содержимое директории',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if directory exists
   */
  async exists(targetPath: string): Promise<boolean> {
    const validation = this.pathValidator.validatePath(targetPath);
    if (!validation.valid) {
      return false;
    }

    try {
      const stats = await fs.stat(validation.resolvedPath!);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
