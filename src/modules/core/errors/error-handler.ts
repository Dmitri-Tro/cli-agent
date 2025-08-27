/**
 * Centralized Error Handler Service
 * Provides consistent error handling across all modules
 */

import { CLIAgentError, ErrorFactory } from './cli-error';
import { logError, cliLogger } from '../logging/logger';
import type { Logger } from 'pino';

export interface ErrorHandlingOptions {
  /**
   * Whether to show detailed error information to user
   */
  showDetails?: boolean;
  
  /**
   * Whether to log the error
   */
  logError?: boolean;
  
  /**
   * Whether to attempt graceful degradation
   */
  attemptRecovery?: boolean;
  
  /**
   * Custom logger to use
   */
  logger?: Logger;
  
  /**
   * Additional context for error
   */
  context?: Record<string, unknown>;
}

export interface ErrorRecoveryResult {
  /**
   * Whether recovery was successful
   */
  recovered: boolean;
  
  /**
   * Message about recovery attempt
   */
  message: string;
  
  /**
   * Whether the operation should be retried
   */
  shouldRetry: boolean;
}

/**
 * Centralized error handler for consistent error management
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryStrategies = new Map<string, (_error: CLIAgentError) => Promise<ErrorRecoveryResult>>();

  private constructor() {
    this.registerDefaultRecoveryStrategies();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with appropriate strategy
   */
  async handleError(
    error: unknown,
    operation?: string,
    options: ErrorHandlingOptions = {}
  ): Promise<CLIAgentError> {
    const {
      showDetails = true,
      logError: shouldLog = true,
      attemptRecovery = true,
      logger = cliLogger,
      context = {},
    } = options;

    // Convert to CLIAgentError if needed
    const cliError = this.ensureCLIAgentError(error, operation, context);

    // Log the error
    if (shouldLog) {
      logError(logger, cliError, { operation, ...context });
    }

    // Attempt recovery if enabled
    if (attemptRecovery) {
      const recoveryResult = await this.attemptRecovery(cliError);
      if (recoveryResult.recovered) {
        logger.info(
          { operation, recovery: recoveryResult },
          `Recovered from error: ${recoveryResult.message}`
        );
      }
    }

    // Display to user if needed
    if (showDetails) {
      this.displayErrorToUser(cliError);
    }

    return cliError;
  }

  /**
   * Handle error and throw it (for cases where error should propagate)
   */
  async handleAndThrow(
    _error: unknown,
    operation?: string,
    options: ErrorHandlingOptions = {}
  ): Promise<never> {
    const cliError = await this.handleError(_error, operation, options);
    throw cliError;
  }

  /**
   * Handle error with automatic graceful degradation
   */
  async handleWithFallback<T>(
    error: unknown,
    fallbackValue: T,
    operation?: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> {
    await this.handleError(error, operation, {
      ...options,
      attemptRecovery: true,
    });

    // Return fallback value instead of throwing
    // Note: Cannot modify readonly context, but fallback is used
    return fallbackValue;
  }

  /**
   * Register custom recovery strategy for specific error codes
   */
  registerRecoveryStrategy(
    errorCodePattern: string,
    strategy: (_error: CLIAgentError) => Promise<ErrorRecoveryResult>
  ): void {
    this.recoveryStrategies.set(errorCodePattern, strategy);
  }

  /**
   * Display error to user in a user-friendly format
   */
  private displayErrorToUser(error: CLIAgentError): void {
    // Display error message
    console.log(error.formatForUser());
  }

  /**
   * Ensure error is a CLIAgentError
   */
  private ensureCLIAgentError(
    error: unknown,
    operation?: string,
    context?: Record<string, unknown>
  ): CLIAgentError {
    if (error instanceof CLIAgentError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to categorize common Node.js errors
      if (error.message.includes('ENOENT')) {
        return ErrorFactory.filesystemPathNotFound(operation);
      }
      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        return ErrorFactory.filesystemPermissionDenied(operation);
      }
      if (error.message.includes('EEXIST')) {
        return ErrorFactory.filesystemOperationFailed('create', operation, error.message);
      }
    }

    return ErrorFactory.unknown(error, { operation, ...context });
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(error: CLIAgentError): Promise<ErrorRecoveryResult> {
    // Look for matching recovery strategy
    for (const [pattern, strategy] of this.recoveryStrategies) {
      if (error.code.includes(pattern) || pattern === '*') {
        try {
          return await strategy(error);
        } catch {
          // Recovery failed, continue to next strategy
          continue;
        }
      }
    }

    return {
      recovered: false,
      message: 'No recovery strategy available',
      shouldRetry: false,
    };
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultRecoveryStrategies(): void {
    // OpenAI rate limit recovery
    this.registerRecoveryStrategy('OPENAI_003', async (error) => {
      const retryAfter = (error.context?.retryAfter as number) || 5000;
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return {
        recovered: true,
        message: `Waited ${retryAfter}ms for rate limit to reset`,
        shouldRetry: true,
      };
    });

    // Filesystem permission recovery (suggest alternatives)
    this.registerRecoveryStrategy('FS_005', async (error) => {
      const path = error.context?.path as string;
      return {
        recovered: false,
        message: `Consider using a different location or running with elevated permissions for: ${path}`,
        shouldRetry: false,
      };
    });

    // Path not found recovery (suggest creation)
    this.registerRecoveryStrategy('FS_002', async (error) => {
      const path = error.context?.path as string;
      return {
        recovered: false,
        message: `Path does not exist: ${path}. Consider creating it first.`,
        shouldRetry: false,
      };
    });

    // Operation mutex locked recovery
    this.registerRecoveryStrategy('OP_001', async (error) => {
      const currentOp = error.context?.currentOperation as string;
      return {
        recovered: false,
        message: `Wait for current operation to complete: ${currentOp}`,
        shouldRetry: true,
      };
    });
  }
}

/**
 * Convenience function for handling errors
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Decorator for automatic error handling
 */
export function handleErrors(
  options: ErrorHandlingOptions = {}
): MethodDecorator {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (..._args: unknown[]): Promise<unknown> {
      try {
        return await originalMethod.apply(this, _args);
      } catch (error) {
        return await errorHandler.handleError(error, String(_propertyKey), options);
      }
    };

    return descriptor;
  };
}

/**
 * Higher-order function for wrapping functions with error handling
 */
export function withErrorHandling<T extends (..._args: unknown[]) => unknown>(
  fn: T,
  operation?: string,
  options: ErrorHandlingOptions = {}
): T {
  return (async (..._args: unknown[]) => {
    try {
      return await fn(..._args);
    } catch (error) {
      await errorHandler.handleError(error, operation || fn.name, options);
      throw error; // Re-throw after handling
    }
  }) as T;
}

/**
 * Higher-order function for wrapping functions with graceful degradation
 */
export function withGracefulDegradation<T, R>(
  fn: (..._args: unknown[]) => Promise<T> | T,
  fallbackValue: R,
  operation?: string,
  options: ErrorHandlingOptions = {}
): (..._args: unknown[]) => Promise<T | R> {
  return async (..._args: unknown[]) => {
    try {
      const result = await fn(..._args);
      return result;
    } catch (error) {
      return await errorHandler.handleWithFallback(
        error,
        fallbackValue,
        operation || fn.name,
        options
      );
    }
  };
}
