import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { PathValidator } from '../validation/path-validator';
import { MAX_FILE_SIZE_FOR_DISPLAY, DEFAULT_FILE_ENCODING } from '../constants';
import { EncodingSystem } from '../../../lib/encoding-system';
import type { OperationResult, CreateFileOptions, WriteFileMode, FileStats } from '../types';

/**
 * File Operations Service - handles all file-related operations
 */
export class FileOperations {
  private readonly pathValidator: PathValidator;

  constructor(workingDirectory?: string) {
    this.pathValidator = new PathValidator(workingDirectory);
  }

  /**
   * Create a file
   */
  async createFile(
    targetPath: string,
    content = '',
    options: CreateFileOptions = {}
  ): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(targetPath, 'создание файла');
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;
    const { overwrite = false } = options;

    try {
      // Check if file already exists
      if (existsSync(resolvedPath) && !overwrite) {
        return {
          success: false,
          message: EncodingSystem.fixEncoding('Файл уже существует'),
          path: targetPath,
          error: EncodingSystem.fixEncoding(
`Файл '${targetPath}' уже существует. Используйте опцию перезаписи для замены.`
          ),
        };
      }

      // Create parent directory if it doesn't exist
      const parentDir = path.dirname(resolvedPath);
      if (!existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }

      await fs.writeFile(resolvedPath, content, { encoding: DEFAULT_FILE_ENCODING });

      return {
        success: true,
        message: EncodingSystem.fixEncoding(`Файл '${targetPath}' успешно создан`),
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: EncodingSystem.fixEncoding('Не удалось создать файл'),
        path: targetPath,
        error: EncodingSystem.fixErrorEncoding(error),
      };
    }
  }

  /**
   * Write content to file
   */
  async writeFile(
    targetPath: string,
    content: string,
    mode: WriteFileMode = 'overwrite'
  ): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(targetPath, 'запись в файл');
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (mode === 'append') {
        await fs.appendFile(resolvedPath, content, DEFAULT_FILE_ENCODING);
      } else {
        // Create parent directory if it doesn't exist
        const parentDir = path.dirname(resolvedPath);
        if (!existsSync(parentDir)) {
          await fs.mkdir(parentDir, { recursive: true });
        }

        await fs.writeFile(resolvedPath, content, { encoding: DEFAULT_FILE_ENCODING });
      }

      return {
        success: true,
        message: `Содержимое успешно записано в '${targetPath}'`,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось записать файл',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read file contents
   */
  async readFile(targetPath: string, lines?: number, fromLine?: number): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(targetPath, 'чтение файла');
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: EncodingSystem.fixEncoding('Файл не существует'),
          path: targetPath,
          error: EncodingSystem.fixEncoding(`Файл '${targetPath}' не найден`),
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          message: 'Указанный путь не является файлом',
          path: targetPath,
          error: `'${targetPath}' не является файлом`,
        };
      }

      // Check file size (limit for safety)
      if (stats.size > MAX_FILE_SIZE_FOR_DISPLAY) {
        return {
          success: false,
          message: 'Файл слишком большой для просмотра',
          path: targetPath,
          error: `Файл '${targetPath}' превышает ${MAX_FILE_SIZE_FOR_DISPLAY / 1024 / 1024}MB. Используйте параметр lines для частичного просмотра.`,
        };
      }

      const content = await fs.readFile(resolvedPath, DEFAULT_FILE_ENCODING);
      const allLines = content.split('\n');

      let displayContent: string[];
      let message = `Содержимое файла '${targetPath}'`;

      if (lines !== undefined || fromLine !== undefined) {
        const startLine = fromLine ? fromLine - 1 : 0;
        const endLine = lines ? startLine + lines : allLines.length;
        displayContent = allLines.slice(startLine, endLine);

        message += ` (строки ${startLine + 1}-${Math.min(endLine, allLines.length)} из ${allLines.length})`;
      } else {
        displayContent = allLines;
        message += ` (${allLines.length} строк)`;
      }

      const result = displayContent.join('\n');

      return {
        success: true,
        message: `${message}:\n${result}`,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось прочитать файл',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(targetPath: string): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(targetPath, 'удаление файла');
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: EncodingSystem.fixEncoding('Файл не существует'),
          path: targetPath,
          error: EncodingSystem.fixEncoding(`Файл '${targetPath}' не найден`),
        };
      }

      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          message: EncodingSystem.fixEncoding('Это директория, а не файл'),
          path: targetPath,
          error: EncodingSystem.fixEncoding(
            `'${targetPath}' является директорией. Используйте команду удаления директории.`
          ),
        };
      }

      await fs.unlink(resolvedPath);

      return {
        success: true,
        message: EncodingSystem.fixEncoding(`Файл '${targetPath}' успешно удален`),
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: EncodingSystem.fixEncoding('Не удалось удалить файл'),
        path: targetPath,
        error: EncodingSystem.fixErrorEncoding(error),
      };
    }
  }

  /**
   * Modify file content (search and replace)
   */
  async modifyFile(
    targetPath: string,
    search: string,
    replace: string,
    global = false
  ): Promise<OperationResult> {
    const validationError = this.pathValidator.handlePathValidation(
      targetPath,
      'модификация файла'
    );
    if (validationError) return validationError;

    const resolvedPath = this.pathValidator.validatePath(targetPath).resolvedPath!;

    try {
      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: EncodingSystem.fixEncoding('Файл не существует'),
          path: targetPath,
          error: EncodingSystem.fixEncoding(`Файл '${targetPath}' не найден`),
        };
      }

      const content = await fs.readFile(resolvedPath, DEFAULT_FILE_ENCODING);
      
      let newContent: string;
      
      // If search is empty, replace entire file content (rewrite operation)
      if (search === '' || search.trim() === '') {
        newContent = replace;
      } else {
        // Normal search and replace operation
        const searchRegex = new RegExp(
          search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          global ? 'g' : ''
        );
        newContent = content.replace(searchRegex, replace);

        if (content === newContent) {
          return {
            success: false,
            message: EncodingSystem.fixEncoding('Текст для замены не найден'),
            path: targetPath,
            error: EncodingSystem.fixEncoding(
              `Текст '${search}' не найден в файле '${targetPath}'`
            ),
          };
        }
      }

      await fs.writeFile(resolvedPath, newContent, DEFAULT_FILE_ENCODING);

      return {
        success: true,
        message: `Файл '${targetPath}' успешно модифицирован`,
        path: targetPath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Не удалось модифицировать файл',
        path: targetPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if file or directory exists
   */
  async exists(targetPath: string): Promise<boolean> {
    const validation = this.pathValidator.validatePath(targetPath);
    if (!validation.valid) {
      return false;
    }

    return existsSync(validation.resolvedPath!);
  }

  /**
   * Get file or directory stats
   */
  async getStats(
    targetPath: string
  ): Promise<{ success: boolean; stats?: FileStats; error?: string }> {
    const validation = this.pathValidator.validatePath(targetPath);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Unknown validation error',
      };
    }

    try {
      const stats = await fs.stat(validation.resolvedPath!);
      return {
        success: true,
        stats: {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
