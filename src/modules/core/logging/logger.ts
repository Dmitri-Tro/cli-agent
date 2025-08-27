import pino from 'pino';
import { CLIAgentError } from '../errors/cli-error';

/**
 * Logger configuration
 */
interface LoggerOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  redact?: string[];
  component?: string;
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { level = 'info', redact = ['password', 'token', 'key', 'secret'], component } = options;

  // Disable pretty printing in production or if level is warn/error (interactive mode)
  const useTransport =
    process.env.NODE_ENV === 'development' && (level === 'debug' || level === 'info');

  const config: pino.LoggerOptions = {
    level,
    redact: {
      paths: redact,
      censor: '***REDACTED***',
    },
    formatters: {
      level: label => ({ level: label }),
      bindings: bindings => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        component,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (useTransport) {
    config.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(config);
}

/**
 * Default application logger
 */
export const appLogger = createLogger({
  component: 'app',
  level: process.env.NODE_ENV === 'development' ? 'warn' : 'error',
});

/**
 * CLI-specific logger
 */
export const cliLogger = createLogger({
  component: 'cli',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

/**
 * OpenAI API logger
 */
export const openAILogger = createLogger({
  component: 'openai',
  redact: ['api_key', 'authorization', 'apiKey'],
  level: process.env.NODE_ENV === 'development' ? 'warn' : 'error',
});

/**
 * Filesystem operations logger
 */
export const filesystemLogger = createLogger({
  component: 'filesystem',
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

/**
 * Log error with context
 */
export function logError(
  logger: pino.Logger,
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (error instanceof CLIAgentError) {
    logger.error(
      {
        err: error.toJSON(),
        context,
      },
      error.userMessage
    );
  } else if (error instanceof Error) {
    logger.error(
      {
        err: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
      },
      error.message
    );
  } else {
    logger.error(
      {
        err: { message: String(error) },
        context,
      },
      String(error)
    );
  }
}

/**
 * Log operation start
 */
export function logOperationStart(
  logger: pino.Logger,
  operation: string,
  params?: Record<string, unknown>
): void {
  logger.info({ operation, params }, `Starting operation: ${operation}`);
}

/**
 * Log operation success
 */
export function logOperationSuccess(
  logger: pino.Logger,
  operation: string,
  result?: Record<string, unknown>
): void {
  logger.info({ operation, result }, `Operation completed: ${operation}`);
}

/**
 * Log operation failure
 */
export function logOperationFailure(
  logger: pino.Logger,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  logError(logger, error, { operation, ...context });
}
