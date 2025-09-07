/**
 * Comprehensive Error Handling Tests
 * Tests for error factory, error codes, and user messaging system
 */

import { describe, it, expect } from 'vitest';
import { 
  CLIAgentError, 
  ErrorFactory, 
  ErrorCode, 
  getUserMessage, 
  getRecoverySuggestions
} from '../../../src/modules/core/errors';

describe('Comprehensive Error Handling Tests', () => {
  
  describe('Error Factory Methods', () => {
    it('should create OpenAI API key error', () => {
      const error = ErrorFactory.openAIInvalidKey('Test message');
      
      expect(error).toBeInstanceOf(CLIAgentError);
      expect(error.code).toBe(ErrorCode.OPENAI_API_KEY_INVALID);
      expect(error.userMessage).toBe('Неверный API ключ OpenAI. Проверьте настройки.');
    });

    it('should create OpenAI quota exceeded error', () => {
      const error = ErrorFactory.openAIQuotaExceeded();
      
      expect(error.code).toBe(ErrorCode.OPENAI_QUOTA_EXCEEDED);
      expect(error.userMessage).toBe('Превышена квота OpenAI. Проверьте ваш план подписки.');
    });

    it('should create OpenAI rate limit error', () => {
      const error = ErrorFactory.openAIRateLimit();
      
      expect(error.code).toBe(ErrorCode.OPENAI_RATE_LIMIT);
      expect(error.userMessage).toContain('лимит запросов');
    });

    it('should create OpenAI service unavailable error', () => {
      const error = ErrorFactory.openAIServiceUnavailable(503);
      
      expect(error.code).toBe(ErrorCode.OPENAI_SERVICE_UNAVAILABLE);
      expect(error.userMessage).toContain('недоступен');
    });

    it('should create OpenAI invalid response error', () => {
      const error = ErrorFactory.openAIInvalidResponse('Invalid JSON');
      
      expect(error.code).toBe(ErrorCode.OPENAI_INVALID_RESPONSE);
      expect(error.userMessage).toContain('некорректный ответ');
    });

    it('should create filesystem errors', () => {
      const accessDeniedError = ErrorFactory.filesystemAccessDenied('/protected/file');
      expect(accessDeniedError.code).toBe(ErrorCode.FILESYSTEM_ACCESS_DENIED);
      expect(accessDeniedError.userMessage).toContain('Доступ к файловой системе запрещен');

      const pathNotFoundError = ErrorFactory.filesystemPathNotFound('/missing/path');
      expect(pathNotFoundError.code).toBe(ErrorCode.FILESYSTEM_PATH_NOT_FOUND);
      expect(pathNotFoundError.userMessage).toContain('путь не найден');

      const invalidPathError = ErrorFactory.filesystemPathInvalid('invalid\\path');
      expect(invalidPathError.code).toBe(ErrorCode.FILESYSTEM_PATH_INVALID);
      expect(invalidPathError.userMessage).toContain('путь недопустим');
    });

    it('should create command parsing errors', () => {
      const parseFailedError = ErrorFactory.commandParseFailed('Cannot understand');
      expect(parseFailedError.code).toBe(ErrorCode.COMMAND_PARSE_FAILED);
      expect(parseFailedError.userMessage).toContain('Не удалось распознать');

      const invalidIntentError = ErrorFactory.commandInvalidIntent({ type: 'invalid' });
      expect(invalidIntentError.code).toBe(ErrorCode.COMMAND_INVALID_INTENT);
      expect(invalidIntentError.userMessage).toContain('недопустимые параметры');
    });

    it('should create backup/undo errors', () => {
      const backupFailedError = ErrorFactory.backupCreationFailed('disk full');
      expect(backupFailedError.code).toBe(ErrorCode.BACKUP_CREATION_FAILED);

      const restoreFailedError = ErrorFactory.backupRestorationFailed('backup corrupted');
      expect(restoreFailedError.code).toBe(ErrorCode.BACKUP_RESTORATION_FAILED);

      const undoFailedError = ErrorFactory.undoOperationFailed('no history');
      expect(undoFailedError.code).toBe(ErrorCode.UNDO_OPERATION_FAILED);

      const historyEmptyError = ErrorFactory.undoHistoryEmpty();
      expect(historyEmptyError.code).toBe(ErrorCode.UNDO_HISTORY_EMPTY);
    });

    it('should create unknown errors with context', () => {
      const originalError = new Error('Something went wrong');
      const context = { operation: 'test_operation', file: 'test.txt' };
      
      const error = ErrorFactory.unknown(originalError, context);
      
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(error.context).toMatchObject(context);
      expect(error.message).toContain('Something went wrong');
    });
  });

  describe('Error Code to User Message Mapping', () => {
    it('should provide Russian user messages for all error codes', () => {
      const allErrorCodes = Object.values(ErrorCode);
      
      for (const code of allErrorCodes) {
        const message = getUserMessage(code);
        
        expect(message).toBeDefined();
        expect(message.length).toBeGreaterThan(0);
        expect(message).toMatch(/[а-яё]/i); // Should contain Cyrillic characters
      }
    });

    it('should provide consistent message format', () => {
      const testCodes = [
        ErrorCode.OPENAI_API_KEY_INVALID,
        ErrorCode.FILESYSTEM_ACCESS_DENIED,
        ErrorCode.COMMAND_PARSE_FAILED,
        ErrorCode.BACKUP_CREATION_FAILED
      ];

      for (const code of testCodes) {
        const message = getUserMessage(code);
        
        // Should be properly formatted Russian text
        expect(message).not.toMatch(/[ðÐ]/); // No encoding corruption
        expect(message.endsWith('.')).toBe(true); // Should end with period
        expect(message[0]).toBe(message[0]?.toUpperCase()); // Should start with capital
      }
    });
  });

  describe('Error Suggestions System', () => {
    it('should provide appropriate suggestions for OpenAI errors', () => {
      const apiKeyError = ErrorFactory.openAIInvalidKey('Invalid key');
      const suggestions = getRecoverySuggestions(apiKeyError.code);
      expect(suggestions).toContain('Проверьте правильность API ключа в переменной окружения OPENAI_API_KEY');
      expect(suggestions).toContain('Убедитесь, что ключ действителен на платформе OpenAI');

      const quotaError = ErrorFactory.openAIQuotaExceeded();
      const quotaSuggestions = getRecoverySuggestions(quotaError.code);
      expect(quotaSuggestions).toContain('Проверьте использование квоты в панели OpenAI');
      expect(quotaSuggestions).toContain('Обновите план подписки при необходимости');

      const rateLimitError = ErrorFactory.openAIRateLimit();
      const rateSuggestions = getRecoverySuggestions(rateLimitError.code);
      expect(rateSuggestions).toContain('Подождите несколько секунд перед следующим запросом');
      expect(rateSuggestions).toContain('Рассмотрите возможность увеличения лимитов в настройках OpenAI');
    });

    it('should provide appropriate suggestions for filesystem errors', () => {
      const accessDeniedError = ErrorFactory.filesystemAccessDenied('/protected');
      const suggestions = getRecoverySuggestions(accessDeniedError.code);
      expect(suggestions).toContain('Проверьте права доступа к указанному пути');
      expect(suggestions).toContain('Запустите приложение с правами администратора при необходимости');

      const pathNotFoundError = ErrorFactory.filesystemPathNotFound('/missing');
      const pathSuggestions = getRecoverySuggestions(pathNotFoundError.code);
      expect(pathSuggestions).toContain('Убедитесь, что указанный путь существует');
      expect(pathSuggestions).toContain('Проверьте правильность написания пути');
    });

    it('should provide appropriate suggestions for command parsing errors', () => {
      const parseFailedError = ErrorFactory.commandParseFailed('Unclear command');
      const suggestions = getRecoverySuggestions(parseFailedError.code);
      expect(suggestions).toContain('Попробуйте переформулировать команду более четко');
      expect(suggestions).toContain('Используйте команду "помощь" для просмотра примеров');

      const validationError = ErrorFactory.commandValidationFailed('field', 'missing', 'string expected');
      const validationSuggestions = getRecoverySuggestions(validationError.code);
      expect(validationSuggestions).toContain('Проверьте корректность входных данных');
    });

    it('should provide appropriate suggestions for backup/undo errors', () => {
      const backupError = ErrorFactory.backupCreationFailed('Disk full');
      const suggestions = getRecoverySuggestions(backupError.code);
      expect(suggestions).toContain('Проверьте доступное место на диске');
      expect(suggestions).toContain('Убедитесь, что есть права на запись в рабочую директорию');

      const undoError = ErrorFactory.undoHistoryEmpty();
      const undoSuggestions = getRecoverySuggestions(undoError.code);
      expect(undoSuggestions).toContain('Выполните какие-либо операции перед использованием отмены');
      expect(undoSuggestions).toContain('История операций очищается при перезапуске приложения');
    });
  });

  describe('Error Context and Stack Traces', () => {
    it('should preserve original error information', () => {
      const originalError = new Error('Original message');
      
      const wrappedError = ErrorFactory.unknown(originalError, { test: 'context' });
      
      expect(wrappedError.message).toContain('Original message');
      expect(wrappedError).toBeInstanceOf(CLIAgentError);
      expect(wrappedError.context).toMatchObject({ test: 'context' });
    });

    it('should handle errors without stack traces', () => {
      const errorLikeObject = { message: 'Error without stack' };
      
      const wrappedError = ErrorFactory.unknown(errorLikeObject, {});
      
      expect(wrappedError).toBeInstanceOf(CLIAgentError);
      expect(wrappedError.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should handle string errors', () => {
      const stringError = 'Simple string error';
      
      const wrappedError = ErrorFactory.unknown(stringError, { source: 'test' });
      
      expect(wrappedError.message).toContain(stringError);
      expect(wrappedError.context).toMatchObject({ source: 'test' });
    });
  });

  describe('Error Handler Integration', () => {
    it('should format errors consistently', () => {
      const testErrors = [
        ErrorFactory.openAIInvalidKey('Test'),
        ErrorFactory.filesystemAccessDenied('/test'),
        ErrorFactory.commandParseFailed('Test'),
        ErrorFactory.backupCreationFailed('Test')
      ];

      for (const error of testErrors) {
        // Test that error handler can process these errors
        expect(error.userMessage).toBeDefined();
        const suggestions = getRecoverySuggestions(error.code);
        expect(suggestions).toBeDefined();
        expect(suggestions.length).toBeGreaterThan(0);
        
        // All suggestions should be in Russian
        for (const suggestion of suggestions) {
          expect(suggestion).toMatch(/[а-яё]/i);
          expect(suggestion).not.toMatch(/[ðÐ]/); // No encoding issues
        }
      }
    });

    it('should handle nested error contexts', () => {
      const innerError = new Error('Inner error');
      const context1 = { level: 1, operation: 'inner' };
      const middleError = ErrorFactory.unknown(innerError, context1);
      
      const context2 = { level: 2, operation: 'outer' };
      const outerError = ErrorFactory.unknown(middleError, context2);
      
      expect(outerError.context).toMatchObject({ level: 2, operation: 'outer' });
      expect(outerError.message).toContain('Inner error');
    });
  });

  describe('Localization and Encoding', () => {
    it('should handle cyrillic text in error messages correctly', () => {
      const cyrillicPath = 'тест/папка/файл.txt';
      const error = ErrorFactory.filesystemPathNotFound(cyrillicPath);
      
      expect(error.userMessage).toMatch(/[а-яё]/i);
      expect(error.userMessage).not.toMatch(/[ðÐ]/); // No encoding corruption
      expect(error.code).toBe(ErrorCode.FILESYSTEM_PATH_NOT_FOUND);
    });

    it('should preserve special characters in file paths', () => {
      const specialPaths = [
        'файл с пробелами.txt',
        'файл-с-дефисами.txt', 
        'файл_с_подчёркиваниями.txt',
        'файл(с)скобками.txt'
      ];

      for (const path of specialPaths) {
        const error = ErrorFactory.filesystemPathNotFound(path);
        
        expect(error.userMessage).toBeDefined();
        expect(error.code).toBe(ErrorCode.FILESYSTEM_PATH_NOT_FOUND);
      }
    });

    it('should handle mixed language content', () => {
      const mixedPath = 'проект/src/components/русский-компонент.tsx';
      const error = ErrorFactory.filesystemPathNotFound(mixedPath);
      
      expect(error.userMessage).toMatch(/[а-яё]/i);
      expect(error.code).toBe(ErrorCode.FILESYSTEM_PATH_NOT_FOUND);
    });
  });

  describe('Error Code Coverage', () => {
    it('should have factory methods for all error codes', () => {
      const allErrorCodes = Object.values(ErrorCode);
      const factoryMethodCodes = new Set<ErrorCode>();

      // Test each factory method exists and returns correct code
      factoryMethodCodes.add(ErrorFactory.openAIInvalidKey('test').code);
      factoryMethodCodes.add(ErrorFactory.openAIQuotaExceeded().code);
      factoryMethodCodes.add(ErrorFactory.openAIRateLimit().code);
      factoryMethodCodes.add(ErrorFactory.openAIServiceUnavailable(500).code);
      factoryMethodCodes.add(ErrorFactory.openAIInvalidResponse('test').code);
      
      factoryMethodCodes.add(ErrorFactory.filesystemAccessDenied('test').code);
      factoryMethodCodes.add(ErrorFactory.filesystemPathNotFound('test').code);
      factoryMethodCodes.add(ErrorFactory.filesystemPathInvalid('test').code);
      factoryMethodCodes.add(ErrorFactory.filesystemOperationFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.filesystemPermissionDenied('test').code);
      
      factoryMethodCodes.add(ErrorFactory.commandParseFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.commandInvalidIntent({}).code);
      factoryMethodCodes.add(ErrorFactory.commandValidationFailed('field', 'value', 'expected').code);
      factoryMethodCodes.add(ErrorFactory.commandExecutionFailed('test').code);
      
      factoryMethodCodes.add(ErrorFactory.operationMutexLocked('test').code);
      factoryMethodCodes.add(ErrorFactory.operationCancelled('test').code);
      factoryMethodCodes.add(ErrorFactory.operationTimeout('test').code);
      factoryMethodCodes.add(ErrorFactory.operationRollbackFailed('test').code);
      
      factoryMethodCodes.add(ErrorFactory.backupCreationFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.backupRestorationFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.undoOperationFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.undoHistoryEmpty().code);
      
      factoryMethodCodes.add(ErrorFactory.configValidationFailed('config', 'details').code);
      factoryMethodCodes.add(ErrorFactory.configEnvironmentInvalid('test').code);
      
      factoryMethodCodes.add(ErrorFactory.unknown('test', {}).code);
      factoryMethodCodes.add(ErrorFactory.initializationFailed('test').code);
      factoryMethodCodes.add(ErrorFactory.gracefulShutdownFailed('test').code);

      // Check coverage - every error code should have a factory method
      const missingCodes = allErrorCodes.filter(code => !factoryMethodCodes.has(code));
      expect(missingCodes).toHaveLength(0);
    });
  });
});
