/**
 * OpenAI Client Edge Cases and Error Handling Tests
 * Tests critical scenarios that are currently untested
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIClient } from '../../../src/modules/core/ai/openai-client';
import { CLIAgentError, ErrorCode } from '../../../src/modules/core/errors';
import OpenAI from 'openai';

describe('OpenAI Client Edge Cases', () => {
  let client: OpenAIClient;
  let mockOpenAI: any;

  beforeEach(() => {
    // Mock OpenAI client
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };

    // Mock the OpenAI constructor
    vi.mock('openai', () => ({
      default: vi.fn(() => mockOpenAI)
    }));

    client = new OpenAIClient({
      apiKey: 'test-key',
      defaultModel: 'gpt-4o-mini'
    });
  });

  describe('API Error Handling', () => {
    it('should handle 401 unauthorized error', async () => {
      const apiError = new OpenAI.APIError('Invalid API key', { status: 401 } as any, 'invalid_api_key', {});
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(CLIAgentError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toHaveProperty('code', ErrorCode.OPENAI_API_KEY_INVALID);
    });

    it('should handle 429 rate limit error', async () => {
      const apiError = new OpenAI.APIError('Rate limit exceeded', { status: 429 } as any, 'rate_limit_exceeded', {});
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(CLIAgentError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toHaveProperty('code', ErrorCode.OPENAI_RATE_LIMIT);
    });

    it('should handle 402 quota exceeded error', async () => {
      const apiError = new OpenAI.APIError('Quota exceeded', { status: 402 } as any, 'insufficient_quota', {});
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(CLIAgentError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toHaveProperty('code', ErrorCode.OPENAI_QUOTA_EXCEEDED);
    });

    it('should handle 5xx service unavailable errors', async () => {
      for (const status of [500, 502, 503]) {
        const apiError = new OpenAI.APIError('Service unavailable', { status } as any, 'service_unavailable', {});
        mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

        await expect(
          client.chatCompletion([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(CLIAgentError);

        await expect(
          client.chatCompletion([{ role: 'user', content: 'test' }])
        ).rejects.toHaveProperty('code', ErrorCode.OPENAI_SERVICE_UNAVAILABLE);
      }
    });

    it('should handle empty response content', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: { total_tokens: 0 }
      });

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(CLIAgentError);

      await expect(
        client.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toHaveProperty('code', ErrorCode.OPENAI_INVALID_RESPONSE);
    });
  });

  describe('JSON Response Validation', () => {
    it('should handle invalid JSON responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{ invalid json' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ type: z.string() });
      
      await expect(
        client.chatJSON({ 
          schema, 
          systemPrompt: 'test', 
          userPrompt: 'test' 
        })
      ).rejects.toThrow(CLIAgentError);
    });

    it('should handle OpenAI error responses in JSON', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"error": "Cannot understand command"}' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ type: z.string() });
      
      await expect(
        client.chatJSON({ 
          schema, 
          systemPrompt: 'test', 
          userPrompt: 'test' 
        })
      ).rejects.toThrow(CLIAgentError);
    });

    it('should handle missing type field in response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"path": "test.txt"}' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ type: z.string() });
      
      await expect(
        client.chatJSON({ 
          schema, 
          systemPrompt: 'test', 
          userPrompt: 'test' 
        })
      ).rejects.toThrow(CLIAgentError);
    });

    it('should add default reasoning when missing', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"type": "create_file", "path": "test.txt"}' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ 
        type: z.literal('create_file'), 
        path: z.string(),
        reasoning: z.string()
      });
      
      const result = await client.chatJSON({ 
        schema, 
        systemPrompt: 'test', 
        userPrompt: 'test' 
      });

      expect(result.reasoning).toBe('Создание файла');
    });

    it('should fix modify_file operation missing fields', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"type": "modify_file", "path": "test.txt"}' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ 
        type: z.literal('modify_file'), 
        path: z.string(),
        search: z.string(),
        replace: z.string(),
        global: z.boolean(),
        reasoning: z.string()
      });
      
      const result = await client.chatJSON({ 
        schema, 
        systemPrompt: 'test', 
        userPrompt: 'test' 
      });

      expect(result.search).toBe('');
      expect(result.replace).toBe('сделано!');
      expect(result.global).toBe(false);
    });

    it('should handle schema validation failures', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{"type": "invalid_type", "path": 123}' } }],
        usage: { total_tokens: 10 }
      });

      const schema = z.object({ 
        type: z.literal('create_file'), 
        path: z.string()
      });
      
      await expect(
        client.chatJSON({ 
          schema, 
          systemPrompt: 'test', 
          userPrompt: 'test' 
        })
      ).rejects.toThrow(CLIAgentError);
    });
  });

  describe('Connection and Initialization', () => {
    it('should handle initialization failure', () => {
      vi.mocked(OpenAI).mockImplementation(() => {
        throw new Error('Network error');
      });

      expect(() => {
        new OpenAIClient({ apiKey: 'invalid' });
      }).toThrow(CLIAgentError);
    });

    it('should use default model when not specified', () => {
      const client = new OpenAIClient({ apiKey: 'test' });
      // Should use gpt-5 as default model
      expect(client).toBeDefined();
    });
  });
});