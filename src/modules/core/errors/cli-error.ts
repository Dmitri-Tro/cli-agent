/**
 * Error codes for the CLI Agent application
 */
/* eslint-disable no-unused-vars */
export enum ErrorCode {
  // OpenAI API errors
  OPENAI_API_KEY_INVALID = 'OPENAI_001',
  OPENAI_QUOTA_EXCEEDED = 'OPENAI_002',
  OPENAI_RATE_LIMIT = 'OPENAI_003',
  OPENAI_SERVICE_UNAVAILABLE = 'OPENAI_004',
  OPENAI_INVALID_RESPONSE = 'OPENAI_005',

  // Filesystem errors
  FILESYSTEM_ACCESS_DENIED = 'FS_001',
  FILESYSTEM_PATH_NOT_FOUND = 'FS_002',
  FILESYSTEM_PATH_INVALID = 'FS_003',
  FILESYSTEM_OPERATION_FAILED = 'FS_004',
  FILESYSTEM_PERMISSION_DENIED = 'FS_005',

  // Command parsing errors
  COMMAND_PARSE_FAILED = 'CMD_001',
  COMMAND_INVALID_INTENT = 'CMD_002',
  COMMAND_VALIDATION_FAILED = 'CMD_003',
  COMMAND_EXECUTION_FAILED = 'CMD_004',

  // Operation errors
  OPERATION_MUTEX_LOCKED = 'OP_001',
  OPERATION_CANCELLED = 'OP_002',
  OPERATION_TIMEOUT = 'OP_003',
  OPERATION_ROLLBACK_FAILED = 'OP_004',

  // Backup/Undo errors
  BACKUP_CREATION_FAILED = 'BKP_001',
  BACKUP_RESTORATION_FAILED = 'BKP_002',
  UNDO_OPERATION_FAILED = 'BKP_003',
  UNDO_HISTORY_EMPTY = 'BKP_004',

  // Configuration errors
  CONFIG_VALIDATION_FAILED = 'CFG_001',
  CONFIG_ENVIRONMENT_INVALID = 'CFG_002',

  // General errors
  UNKNOWN_ERROR = 'UNK_001',
  INITIALIZATION_FAILED = 'UNK_002',
  GRACEFUL_SHUTDOWN_FAILED = 'UNK_003',
}
/* eslint-enable no-unused-vars */

/**
 * Get user-friendly error message
 */
export function getUserMessage(code: ErrorCode): string {
  let message: string;
  switch (code) {
    // OpenAI API errors
    case ErrorCode.OPENAI_API_KEY_INVALID:
      message = 'Неверный API ключ OpenAI. Проверьте настройки.';
      break;
    case ErrorCode.OPENAI_QUOTA_EXCEEDED:
      message = 'Превышена квота OpenAI. Проверьте ваш план подписки.';
      break;
    case ErrorCode.OPENAI_RATE_LIMIT:
      message = 'Превышен лимит запросов к OpenAI. Повторите попытку через некоторое время.';
      break;
    case ErrorCode.OPENAI_SERVICE_UNAVAILABLE:
      message = 'Сервис OpenAI временно недоступен. Повторите попытку позже.';
      break;
    case ErrorCode.OPENAI_INVALID_RESPONSE:
      message = 'Получен некорректный ответ от OpenAI. Повторите попытку.';
      break;

    // Filesystem errors
    case ErrorCode.FILESYSTEM_ACCESS_DENIED:
      message = 'Доступ к файловой системе запрещен.';
      break;
    case ErrorCode.FILESYSTEM_PATH_NOT_FOUND:
      message = 'Указанный путь не найден.';
      break;
    case ErrorCode.FILESYSTEM_PATH_INVALID:
      message = 'Указанный путь недопустим.';
      break;
    case ErrorCode.FILESYSTEM_OPERATION_FAILED:
      message = 'Операция с файловой системой завершилась с ошибкой.';
      break;
    case ErrorCode.FILESYSTEM_PERMISSION_DENIED:
      message = 'Недостаточно прав для выполнения операции.';
      break;

    // Command parsing errors
    case ErrorCode.COMMAND_PARSE_FAILED:
      message = 'Не удалось распознать команду.';
      break;
    case ErrorCode.COMMAND_INVALID_INTENT:
      message = 'Команда содержит недопустимые параметры.';
      break;
    case ErrorCode.COMMAND_VALIDATION_FAILED:
      message = 'Валидация команды не пройдена.';
      break;
    case ErrorCode.COMMAND_EXECUTION_FAILED:
      message = 'Выполнение команды завершилось с ошибкой.';
      break;

    // Operation errors
    case ErrorCode.OPERATION_MUTEX_LOCKED:
      message = 'Невозможно выполнить операцию: другая операция уже выполняется.';
      break;
    case ErrorCode.OPERATION_CANCELLED:
      message = 'Операция была отменена пользователем.';
      break;
    case ErrorCode.OPERATION_TIMEOUT:
      message = 'Время выполнения операции истекло.';
      break;
    case ErrorCode.OPERATION_ROLLBACK_FAILED:
      message = 'Не удалось отменить изменения операции.';
      break;

    // Backup/Undo errors
    case ErrorCode.BACKUP_CREATION_FAILED:
      message = 'Не удалось создать резервную копию.';
      break;
    case ErrorCode.BACKUP_RESTORATION_FAILED:
      message = 'Не удалось восстановить из резервной копии.';
      break;
    case ErrorCode.UNDO_OPERATION_FAILED:
      message = 'Не удалось отменить последнюю операцию.';
      break;
    case ErrorCode.UNDO_HISTORY_EMPTY:
      message = 'История операций пуста - нечего отменять.';
      break;

    // Configuration errors
    case ErrorCode.CONFIG_VALIDATION_FAILED:
      message = 'Конфигурация содержит ошибки.';
      break;
    case ErrorCode.CONFIG_ENVIRONMENT_INVALID:
      message = 'Переменные окружения настроены неверно.';
      break;

    // General errors
    case ErrorCode.INITIALIZATION_FAILED:
      message = 'Не удалось инициализировать приложение.';
      break;
    case ErrorCode.GRACEFUL_SHUTDOWN_FAILED:
      message = 'Не удалось корректно завершить работу приложения.';
      break;
    case ErrorCode.UNKNOWN_ERROR:
    default:
      message = 'Произошла неизвестная ошибка.';
  }
  return message;
}

/**
 * Get recovery suggestions for error
 */
export function getRecoverySuggestions(code: ErrorCode): string[] {
  let suggestions: string[];
  switch (code) {
    // OpenAI API errors
    case ErrorCode.OPENAI_API_KEY_INVALID:
      suggestions = [
        'Проверьте правильность API ключа в переменной окружения OPENAI_API_KEY',
        'Убедитесь, что ключ действителен на платформе OpenAI',
      ];
      break;
    case ErrorCode.OPENAI_QUOTA_EXCEEDED:
      suggestions = [
        'Проверьте использование квоты в панели OpenAI',
        'Обновите план подписки при необходимости',
      ];
      break;
    case ErrorCode.OPENAI_RATE_LIMIT:
      suggestions = [
        'Подождите несколько секунд перед следующим запросом',
        'Рассмотрите возможность увеличения лимитов в настройках OpenAI',
      ];
      break;
    case ErrorCode.OPENAI_SERVICE_UNAVAILABLE:
      suggestions = ['Проверьте статус сервисов OpenAI', 'Повторите попытку через несколько минут'];
      break;
    case ErrorCode.OPENAI_INVALID_RESPONSE:
      suggestions = ['Проверьте стабильность интернет-соединения', 'Повторите запрос'];
      break;

    // Filesystem errors
    case ErrorCode.FILESYSTEM_ACCESS_DENIED:
      suggestions = [
        'Проверьте права доступа к указанному пути',
        'Запустите приложение с правами администратора при необходимости',
      ];
      break;
    case ErrorCode.FILESYSTEM_PATH_NOT_FOUND:
      suggestions = [
        'Убедитесь, что указанный путь существует',
        'Проверьте правильность написания пути',
      ];
      break;
    case ErrorCode.FILESYSTEM_PATH_INVALID:
      suggestions = [
        'Проверьте корректность формата пути',
        'Избегайте использования недопустимых символов в именах файлов/папок',
      ];
      break;
    case ErrorCode.FILESYSTEM_OPERATION_FAILED:
      suggestions = [
        'Проверьте доступное место на диске',
        'Убедитесь, что файл не используется другими приложениями',
      ];
      break;
    case ErrorCode.FILESYSTEM_PERMISSION_DENIED:
      suggestions = [
        'Проверьте права доступа к файлу или директории',
        'Запустите приложение с необходимыми правами',
      ];
      break;

    // Command parsing errors
    case ErrorCode.COMMAND_PARSE_FAILED:
      suggestions = [
        'Попробуйте переформулировать команду более четко',
        'Используйте команду "помощь" для просмотра примеров',
      ];
      break;
    case ErrorCode.COMMAND_INVALID_INTENT:
      suggestions = [
        'Проверьте правильность параметров команды',
        'Убедитесь, что все обязательные параметры указаны',
      ];
      break;
    case ErrorCode.COMMAND_VALIDATION_FAILED:
      suggestions = [
        'Проверьте корректность входных данных',
        'Убедитесь, что значения находятся в допустимых пределах',
      ];
      break;
    case ErrorCode.COMMAND_EXECUTION_FAILED:
      suggestions = [
        'Проверьте правильность команды и параметров',
        'Убедитесь, что все зависимости доступны',
      ];
      break;

    // Operation errors
    case ErrorCode.OPERATION_MUTEX_LOCKED:
      suggestions = [
        'Дождитесь завершения текущей операции',
        'Используйте Ctrl+C для отмены текущей операции при необходимости',
      ];
      break;
    case ErrorCode.OPERATION_CANCELLED:
      suggestions = [
        'Повторите операцию, если отмена была случайной',
        'Убедитесь в корректности данных перед повторным выполнением',
      ];
      break;
    case ErrorCode.OPERATION_TIMEOUT:
      suggestions = [
        'Проверьте стабильность соединения',
        'Попробуйте разбить операцию на меньшие части',
      ];
      break;
    case ErrorCode.OPERATION_ROLLBACK_FAILED:
      suggestions = [
        'Проверьте состояние файловой системы',
        'Возможно потребуется ручное восстановление',
      ];
      break;

    // Backup/Undo errors
    case ErrorCode.BACKUP_CREATION_FAILED:
      suggestions = [
        'Проверьте доступное место на диске',
        'Убедитесь, что есть права на запись в рабочую директорию',
      ];
      break;
    case ErrorCode.BACKUP_RESTORATION_FAILED:
      suggestions = [
        'Проверьте целостность резервной копии',
        'Убедитесь, что исходные файлы не повреждены',
      ];
      break;
    case ErrorCode.UNDO_OPERATION_FAILED:
      suggestions = [
        'Проверьте целостность истории операций',
        'Возможно потребуется ручное восстановление состояния',
      ];
      break;
    case ErrorCode.UNDO_HISTORY_EMPTY:
      suggestions = [
        'Выполните какие-либо операции перед использованием отмены',
        'История операций очищается при перезапуске приложения',
      ];
      break;

    // Configuration errors
    case ErrorCode.CONFIG_VALIDATION_FAILED:
      suggestions = [
        'Проверьте настройки в переменных окружения',
        'Убедитесь, что все обязательные параметры указаны',
      ];
      break;
    case ErrorCode.CONFIG_ENVIRONMENT_INVALID:
      suggestions = [
        'Проверьте файл .env на наличие всех необходимых переменных',
        'Убедитесь, что значения переменных корректны',
      ];
      break;

    // General errors
    case ErrorCode.INITIALIZATION_FAILED:
      suggestions = [
        'Проверьте конфигурацию приложения',
        'Убедитесь, что все зависимости установлены',
      ];
      break;
    case ErrorCode.GRACEFUL_SHUTDOWN_FAILED:
      suggestions = [
        'Проверьте журналы приложения на предмет дополнительной информации',
        'Возможно требуется принудительное завершение процесса',
      ];
      break;
    case ErrorCode.UNKNOWN_ERROR:
    default:
      suggestions = [
        'Проверьте логи приложения для получения подробной информации',
        'Обратитесь за поддержкой, если проблема повторяется',
      ];
  }
  return suggestions;
}

/**
 * Custom error class for CLI Agent
 */
export class CLIAgentError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly suggestions: string[];
  public readonly context: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message?: string, context?: Record<string, unknown>) {
    const cleanMessage = message || getUserMessage(code);

    super(cleanMessage);

    this.name = 'CLIAgentError';
    this.code = code;
    this.userMessage = getUserMessage(code);
    this.suggestions = getRecoverySuggestions(code);
    this.context = context;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CLIAgentError);
    }
  }

  /**
   * Format error for user display
   */
  formatForUser(): string {
    let output = `❌ ${this.userMessage}`;

    if (this.suggestions.length > 0) {
      output += '\n\n💡 Рекомендации:';
      this.suggestions.forEach(suggestion => {
        output += `\n  • ${suggestion}`;
      });
    }

    if (this.context && Object.keys(this.context).length > 0) {
      output += `\n\n🔧 Детали: ${JSON.stringify(this.context, null, 2)}`;
    }

    return output;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.userMessage, // Use userMessage instead of this.message to avoid encoding issues
      code: this.code,
      userMessage: this.userMessage,
      suggestions: this.suggestions,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error factory for common error creation patterns
 */
export class ErrorFactory {
  static openAIInvalidKey(details?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPENAI_API_KEY_INVALID, undefined, {
      service: 'OpenAI',
      details,
    });
  }

  static openAIQuotaExceeded(usage?: Record<string, unknown>): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPENAI_QUOTA_EXCEEDED, undefined, {
      service: 'OpenAI',
      usage,
    });
  }

  static openAIRateLimit(retryAfter?: number): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPENAI_RATE_LIMIT, undefined, {
      service: 'OpenAI',
      retryAfter,
    });
  }

  static openAIServiceUnavailable(status?: number): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPENAI_SERVICE_UNAVAILABLE, undefined, {
      service: 'OpenAI',
      httpStatus: status,
    });
  }

  static openAIInvalidResponse(response?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPENAI_INVALID_RESPONSE, undefined, {
      service: 'OpenAI',
      response,
    });
  }

  // Filesystem errors
  static filesystemAccessDenied(path?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.FILESYSTEM_ACCESS_DENIED, undefined, {
      path,
    });
  }

  static filesystemPathNotFound(path?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.FILESYSTEM_PATH_NOT_FOUND, undefined, {
      path,
    });
  }

  static filesystemPathInvalid(path?: string, reason?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.FILESYSTEM_PATH_INVALID, undefined, {
      path,
      reason,
    });
  }

  static filesystemOperationFailed(operation?: string, path?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.FILESYSTEM_OPERATION_FAILED, undefined, {
      operation,
      path,
      details,
    });
  }

  static filesystemPermissionDenied(path?: string, operation?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.FILESYSTEM_PERMISSION_DENIED, undefined, {
      path,
      operation,
    });
  }

  // Command parsing errors
  static commandParseFailed(command?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.COMMAND_PARSE_FAILED, undefined, {
      command,
      details,
    });
  }

  static commandInvalidIntent(intent?: unknown, validation?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.COMMAND_INVALID_INTENT, undefined, {
      intent,
      validation,
    });
  }

  static commandValidationFailed(field?: string, value?: unknown, expected?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.COMMAND_VALIDATION_FAILED, undefined, {
      field,
      value,
      expected,
    });
  }

  static commandExecutionFailed(command?: string, step?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.COMMAND_EXECUTION_FAILED, undefined, {
      command,
      step,
      details,
    });
  }

  // Operation errors
  static operationMutexLocked(currentOperation?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPERATION_MUTEX_LOCKED, undefined, {
      currentOperation,
    });
  }

  static operationCancelled(operation?: string, reason?: string): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPERATION_CANCELLED, undefined, {
      operation,
      reason,
    });
  }

  static operationTimeout(operation?: string, timeout?: number): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPERATION_TIMEOUT, undefined, {
      operation,
      timeout,
    });
  }

  static operationRollbackFailed(operation?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.OPERATION_ROLLBACK_FAILED, undefined, {
      operation,
      details,
    });
  }

  // Backup/Undo errors
  static backupCreationFailed(path?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.BACKUP_CREATION_FAILED, undefined, {
      path,
      details,
    });
  }

  static backupRestorationFailed(backupId?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.BACKUP_RESTORATION_FAILED, undefined, {
      backupId,
      details,
    });
  }

  static undoOperationFailed(operation?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.UNDO_OPERATION_FAILED, undefined, {
      operation,
      details,
    });
  }

  static undoHistoryEmpty(): CLIAgentError {
    return new CLIAgentError(ErrorCode.UNDO_HISTORY_EMPTY);
  }

  // Configuration errors
  static configValidationFailed(config?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.CONFIG_VALIDATION_FAILED, undefined, {
      config,
      details,
    });
  }

  static configEnvironmentInvalid(variable?: string, value?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.CONFIG_ENVIRONMENT_INVALID, undefined, {
      variable,
      value,
    });
  }

  // General errors
  static initializationFailed(component?: string, details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.INITIALIZATION_FAILED, undefined, {
      component,
      details,
    });
  }

  static gracefulShutdownFailed(details?: unknown): CLIAgentError {
    return new CLIAgentError(ErrorCode.GRACEFUL_SHUTDOWN_FAILED, undefined, {
      details,
    });
  }

  static unknown(error: unknown, context?: Record<string, unknown>): CLIAgentError {
    const message = error instanceof Error ? error.message : String(error);
    return new CLIAgentError(ErrorCode.UNKNOWN_ERROR, message, {
      originalError: error,
      ...context,
    });
  }
}
