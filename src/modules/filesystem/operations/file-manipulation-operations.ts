import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { PathValidator } from '../validation/path-validator';
import type { OperationResult } from '../types';

/**
 * File Manipulation Operations Service - handles file copy, move, rename operations
 */
export class FileManipulationOperations {
  private readonly pathValidator: PathValidator;

  constructor(workingDirectory?: string) {
    this.pathValidator = new PathValidator(workingDirectory);
  }

  /**
   * Copy file
   */
  async copyFile(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    const validation = this.pathValidator.handleDualPathValidation(
      sourcePath,
      destinationPath,
      'копирование файла'
    );
    if (validation.error) return validation.error;

    const resolvedSource = validation.sourceResolved!;
    const resolvedDest = validation.destResolved!;

    try {
      if (!existsSync(resolvedSource)) {
        return {
          success: false,
          message: 'Исходный файл не существует',
          path: sourcePath,
          error: `Файл '${sourcePath}' не найден`,
        };
      }

      if (existsSync(resolvedDest) && !overwrite) {
        return {
          success: false,
          message: 'Файл назначения уже существует',
          path: destinationPath,
          error: `Файл '${destinationPath}' уже существует. Используйте опцию перезаписи.`,
        };
      }

      // Create parent directory if needed
      const parentDir = path.dirname(resolvedDest);
      if (!existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      await fs.copyFile(resolvedSource, resolvedDest);

      return {
        success: true,
        message: `Файл скопирован: '${sourcePath}' → '${destinationPath}'`,
        path: destinationPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось скопировать файл',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Move file
   */
  async moveFile(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    const validation = this.pathValidator.handleDualPathValidation(
      sourcePath,
      destinationPath,
      'перемещение файла'
    );
    if (validation.error) return validation.error;

    const resolvedSource = validation.sourceResolved!;
    const resolvedDest = validation.destResolved!;

    try {
      if (!existsSync(resolvedSource)) {
        return {
          success: false,
          message: 'Исходный файл не существует',
          path: sourcePath,
          error: `Файл '${sourcePath}' не найден`,
        };
      }

      if (existsSync(resolvedDest) && !overwrite) {
        return {
          success: false,
          message: 'Файл назначения уже существует',
          path: destinationPath,
          error: `Файл '${destinationPath}' уже существует. Используйте опцию перезаписи.`,
        };
      }

      // Create parent directory if needed
      const parentDir = path.dirname(resolvedDest);
      if (!existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      await fs.rename(resolvedSource, resolvedDest);

      return {
        success: true,
        message: `Файл перемещен: '${sourcePath}' → '${destinationPath}'`,
        path: destinationPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось переместить файл',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Rename file or directory
   */
  async renameFile(
    targetPath: string,
    newName: string,
    overwrite = false
  ): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(
      targetPath,
      'переименование объекта'
    );
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;
    const parentDir = path.dirname(resolvedPath);
    const newPath = path.join(parentDir, newName);

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: 'Объект не существует',
          path: targetPath,
          error: `Файл или папка '${targetPath}' не найден`,
        };
      }

      // Determine if we're renaming a file or directory
      const stats = await fs.stat(resolvedPath);
      const isDirectory = stats.isDirectory();
      const objectType = isDirectory ? 'Папка' : 'Файл';

      // Check if trying to rename to the same name (no-op)
      if (path.resolve(resolvedPath) === path.resolve(newPath)) {
        return {
          success: true,
          message: `${objectType} ${isDirectory ? 'уже имеет' : 'уже имеет'} имя '${newName}'`,
          path: newName,
        };
      }

      if (existsSync(newPath) && !overwrite) {
        return {
          success: false,
          message: `${objectType} с новым именем уже существует`,
          path: newName,
          error: `${objectType} '${newName}' уже существует. Используйте опцию перезаписи.`,
        };
      }

      await fs.rename(resolvedPath, newPath);

      return {
        success: true,
        message: `${objectType} ${isDirectory ? 'переименована' : 'переименован'}: '${targetPath}' → '${newName}'`,
        path: newName,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось переименовать объект',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(
    sourcePath: string,
    destinationPath: string,
    overwrite = false
  ): Promise<OperationResult> {
    const validation = this.pathValidator.handleDualPathValidation(
      sourcePath,
      destinationPath,
      'копирование директории'
    );
    if (validation.error) return validation.error;

    const resolvedSource = validation.sourceResolved!;
    const resolvedDest = validation.destResolved!;

    try {
      if (!existsSync(resolvedSource)) {
        return {
          success: false,
          message: 'Исходная директория не существует',
          path: sourcePath,
          error: `Директория '${sourcePath}' не найдена`,
        };
      }

      const sourceStats = await fs.stat(resolvedSource);
      if (!sourceStats.isDirectory()) {
        return {
          success: false,
          message: 'Исходный путь не является директорией',
          path: sourcePath,
          error: `'${sourcePath}' не является директорией`,
        };
      }

      if (existsSync(resolvedDest) && !overwrite) {
        return {
          success: false,
          message: 'Директория назначения уже существует',
          path: destinationPath,
          error: `Директория '${destinationPath}' уже существует. Используйте опцию перезаписи.`,
        };
      }

      await this.copyDirectoryRecursive(resolvedSource, resolvedDest);

      return {
        success: true,
        message: `Директория скопирована: '${sourcePath}' → '${destinationPath}'`,
        path: destinationPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось скопировать директорию',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Helper method to copy directory recursively
   */
  private async copyDirectoryRecursive(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }
}
