/**
 * Error handling utilities and helpers
 */

import { ErrorFactory, CLIAgentError } from './cli-error';
import { errorHandler } from './error-handler';

/**
 * Safe file system operation wrapper
 */
export async function safeFileOperation<T>(
  operation: () => Promise<T>,
  context: { operation: string; path?: string }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Convert common Node.js filesystem errors to CLIAgentErrors
    if (error instanceof Error) {
      const message = error.message;
      
      if (message.includes('ENOENT')) {
        throw ErrorFactory.filesystemPathNotFound(context.path);
      }
      if (message.includes('EACCES') || message.includes('EPERM')) {
        throw ErrorFactory.filesystemPermissionDenied(context.path, context.operation);
      }
      if (message.includes('EEXIST')) {
        throw ErrorFactory.filesystemOperationFailed(context.operation, context.path, 'File already exists');
      }
      if (message.includes('ENOTDIR')) {
        throw ErrorFactory.filesystemPathInvalid(context.path, 'Expected directory but found file');
      }
      if (message.includes('EISDIR')) {
        throw ErrorFactory.filesystemPathInvalid(context.path, 'Expected file but found directory');
      }
      if (message.includes('ENOSPC')) {
        throw ErrorFactory.filesystemOperationFailed(context.operation, context.path, 'No space left on device');
      }
    }
    
    // Fallback to generic filesystem error
    throw ErrorFactory.filesystemOperationFailed(context.operation, context.path, error);
  }
}

/**
 * Safe OpenAI operation wrapper
 */
export async function safeOpenAIOperation<T>(
  operation: () => Promise<T>,
  _context: { operation: string }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Rate limiting
      if (message.includes('rate limit') || message.includes('429')) {
        const retryAfter = extractRetryAfter(error);
        throw ErrorFactory.openAIRateLimit(retryAfter);
      }
      
      // Quota exceeded
      if (message.includes('quota') || message.includes('billing')) {
        throw ErrorFactory.openAIQuotaExceeded();
      }
      
      // Invalid API key
      if (message.includes('unauthorized') || message.includes('401') || message.includes('api key')) {
        throw ErrorFactory.openAIInvalidKey();
      }
      
      // Service unavailable
      if (message.includes('503') || message.includes('502') || message.includes('unavailable')) {
        const status = extractStatusCode(error);
        throw ErrorFactory.openAIServiceUnavailable(status);
      }
      
      // Invalid response
      if (message.includes('invalid') || message.includes('malformed')) {
        throw ErrorFactory.openAIInvalidResponse(error.message);
      }
    }
    
    // Fallback to generic OpenAI error
    throw ErrorFactory.openAIInvalidResponse(error);
  }
}

/**
 * Safe command execution wrapper
 */
export async function safeCommandExecution<T>(
  operation: () => Promise<T>,
  context: { command: string; step?: string }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CLIAgentError) {
      throw error; // Re-throw CLIAgentErrors as-is
    }
    
    throw ErrorFactory.commandExecutionFailed(
      context.command,
      context.step,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Safe backup operation wrapper
 */
export async function safeBackupOperation<T>(
  operation: () => Promise<T>,
  context: { operation: 'create' | 'restore' | 'undo'; path?: string; backupId?: string }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    switch (context.operation) {
      case 'create':
        throw ErrorFactory.backupCreationFailed(context.path, error);
      case 'restore':
        throw ErrorFactory.backupRestorationFailed(context.backupId, error);
      case 'undo':
        throw ErrorFactory.undoOperationFailed(context.operation, error);
      default:
        throw ErrorFactory.unknown(error, context);
    }
  }
}

/**
 * Graceful operation runner with fallback
 */
export async function runWithFallback<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  context: { operation: string }
): Promise<T> {
  try {
    return await primaryOperation();
  } catch (primaryError) {
    // Primary operation failed, attempting fallback silently
    
    try {
      const result = await fallbackOperation();
      // Fallback successful
      return result;
    } catch (fallbackError) {
      // Both operations failed, handle the original error
      await errorHandler.handleError(primaryError, context.operation, {
        context: { 
          primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }
      });
      throw primaryError;
    }
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (_error: unknown) => boolean;
    operation?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (): boolean => true,
    operation: _operationName = 'operation'
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      // Retrying operation after delay
      
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Validate operation preconditions
 */
export function validatePreconditions(
  conditions: Array<{ check: boolean; errorFactory: () => CLIAgentError }>
): void {
  for (const condition of conditions) {
    if (!condition.check) {
      throw condition.errorFactory();
    }
  }
}

/**
 * Extract retry-after from error
 */
function extractRetryAfter(error: Error): number | undefined {
  const match = error.message.match(/retry.after[:\s]+(\d+)/i);
  return match && match[1] ? parseInt(match[1], 10) * 1000 : undefined; // Convert to milliseconds
}

/**
 * Extract HTTP status code from error
 */
function extractStatusCode(error: Error): number | undefined {
  const match = error.message.match(/(\d{3})/);
  return match && match[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof CLIAgentError) {
    // These errors are generally recoverable
    const recoverableCodes = [
      'OPENAI_003', // Rate limit
      'FS_002',     // Path not found
      'OP_001',     // Mutex locked
      'OP_002',     // Operation cancelled
    ];
    
    return recoverableCodes.some(code => error.code.includes(code));
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors are often recoverable
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('connection') ||
           message.includes('enotfound');
  }
  
  return false;
}

/**
 * Get error severity level
 */
export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof CLIAgentError) {
    // Critical errors
    if (error.code.includes('CFG_') || error.code.includes('UNK_002')) {
      return 'critical';
    }
    
    // High severity
    if (error.code.includes('FS_005') || error.code.includes('BKP_') || error.code.includes('OP_004')) {
      return 'high';
    }
    
    // Medium severity
    if (error.code.includes('FS_') || error.code.includes('CMD_') || error.code.includes('OP_')) {
      return 'medium';
    }
    
    // Low severity (mostly recoverable)
    return 'low';
  }
  
  // Unknown errors are treated as medium severity
  return 'medium';
}
