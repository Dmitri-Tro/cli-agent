/**
 * Core Module
 *
 * Provides foundational utilities and services for the CLI Agent:
 * - Error handling and custom error types
 * - Logging infrastructure with structured logging
 * - AI integration with OpenAI API
 * - Schema validation for command intents
 */

// Error handling
export {
  CLIAgentError,
  ErrorCode,
  ErrorFactory,
  getUserMessage,
  getRecoverySuggestions,
} from './errors/cli-error';

// Centralized error handler
export {
  ErrorHandler,
  errorHandler,
  handleErrors,
  withErrorHandling,
  withGracefulDegradation,
  type ErrorHandlingOptions,
  type ErrorRecoveryResult,
} from './errors/error-handler';

// Error utilities
export {
  safeFileOperation,
  safeOpenAIOperation,
  safeCommandExecution,
  safeBackupOperation,
  runWithFallback,
  retryOperation,
  validatePreconditions,
  isRecoverableError,
  getErrorSeverity,
} from './errors/error-utilities';

// Logging
export {
  createLogger,
  appLogger,
  cliLogger,
  openAILogger,
  filesystemLogger,
  logError,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
} from './logging/logger';

// AI services
export { OpenAIClient } from './ai/openai-client';

// Enhanced AI parsing
export {
  PromptOptimizer,
  type PromptContext,
  type EnhancedParseResult,
} from './ai/prompt-optimizer';





// Schemas and types
export {
  CommandIntentSchema,
  type CommandIntent,
  type CreateDirectoryIntent,
  type CreateFileIntent,
  type WriteFileIntent,
  type DeleteFileIntent,
  type DeleteDirectoryIntent,
  type ModifyFileIntent,
  type CopyFileIntent,
  type MoveFileIntent,
  type RenameFileIntent,
  type ListDirectoryIntent,
  type ReadFileIntent,
  type UndoIntent,
  type HelpIntent,
  type ExplainIntent,
} from './schemas/intent-schemas';
