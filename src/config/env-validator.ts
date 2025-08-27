import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables first
config();

/**
 * Environment variables validation schema for CLI Agent
 * Ensures type-safe access to configuration values
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  OPENAI_API_KEY: z
    .string()
    .min(1, 'OpenAI API key is required')
    .refine((key) => {
      // В тестовом режиме разрешаем любой ключ
      if (process.env.NODE_ENV === 'test') return true;
      return key.startsWith('sk-');
    }, 'OpenAI API key must start with sk-'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  RATE_LIMIT_MAX_TOKENS: z.coerce
    .number()
    .min(1)
    .max(100)
    .default(3)
    .describe('Maximum tokens for rate limiter'),

  RATE_LIMIT_REFILL_RATE: z.coerce
    .number()
    .min(0.1)
    .max(10)
    .default(0.3)
    .describe('Token refill rate per second'),
});

/**
 * Validated and typed environment configuration
 * Automatically loaded and validated on module import
 */
export const envValidated = EnvSchema.parse(process.env);

/**
 * Type definition for the validated environment
 */
export type Environment = z.infer<typeof EnvSchema>;
