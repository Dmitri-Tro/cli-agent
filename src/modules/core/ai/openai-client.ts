import OpenAI from 'openai';
import { z } from 'zod';
import {
  openAILogger,
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
} from '../logging/logger';
import { ErrorFactory } from '../errors/cli-error';


/**
 * OpenAI client configuration
 */
interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Chat completion options
 */
interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * JSON chat completion options
 */
interface JSONChatOptions<T> extends ChatCompletionOptions {
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
}

/**
 * OpenAI API client wrapper
 */
export class OpenAIClient {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenAIConfig) {
    logOperationStart(openAILogger, 'openai_client_init', {
      baseURL: config.baseURL,
      model: config.defaultModel,
    });

    try {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
        maxRetries: config.maxRetries || 3,
      });

      this.defaultModel = config.defaultModel || 'gpt-5';

      logOperationSuccess(openAILogger, 'openai_client_init');
    } catch (error) {
      logOperationFailure(openAILogger, 'openai_client_init', error);
      throw ErrorFactory.openAIInvalidKey('Failed to initialize OpenAI client');
    }
  }

  /**
   * Send a basic chat completion request
   */
  async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const operationId = `chat_completion_${Date.now()}`;

    logOperationStart(openAILogger, operationId, {
      model: options.model || this.defaultModel,
      messageCount: messages.length,
      temperature: options.temperature,
    });

    try {
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature ?? 1,
        ...(options.maxTokens && { max_tokens: options.maxTokens }),
        ...(options.responseFormat === 'json' && { response_format: { type: 'json_object' } }),
      };

      const response = await this.client.chat.completions.create(completionParams);

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw ErrorFactory.openAIInvalidResponse('Empty response content');
      }

      logOperationSuccess(openAILogger, operationId, {
        responseLength: content.length,
        usage: response.usage,
      });

      return content;
    } catch (error) {
      logOperationFailure(openAILogger, operationId, error);

      if (error instanceof OpenAI.APIError) {
        switch (error.status) {
          case 401:
            throw ErrorFactory.openAIInvalidKey(error.message);
          case 429:
            throw ErrorFactory.openAIRateLimit();
          case 402:
            throw ErrorFactory.openAIQuotaExceeded();
          case 503:
          case 502:
          case 500:
            throw ErrorFactory.openAIServiceUnavailable(error.status);
          default:
            throw ErrorFactory.openAIInvalidResponse(error.message);
        }
      }

      throw ErrorFactory.unknown(error, { operation: operationId });
    }
  }

  /**
   * Send a chat completion request with JSON schema validation
   */
  async chatJSON<T>(options: JSONChatOptions<T>): Promise<T> {
    const operationId = `chat_json_${Date.now()}`;

    logOperationStart(openAILogger, operationId, {
      model: options.model || this.defaultModel,
      schemaType: options.schema.constructor.name,
    });

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ];

      const response = await this.chatCompletion(messages, {
        ...options,
        responseFormat: 'json',
      });

      // Parse and validate JSON response
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        throw ErrorFactory.openAIInvalidResponse('Invalid JSON in response');
      }

      // Handle OpenAI error responses
      if (typeof parsedResponse === 'object' && parsedResponse !== null) {
        const obj = parsedResponse as Record<string, unknown>;
        
        // Check if OpenAI returned an error response instead of a valid command
        if (obj.error && typeof obj.error === 'string' && !obj.type) {
          openAILogger.warn(`OpenAI returned error response: ${obj.error}`);
          throw ErrorFactory.openAIInvalidResponse(`OpenAI error: ${obj.error}`);
        }

        // If no type field, this is not a valid command
        if (!obj.type || typeof obj.type !== 'string') {
          openAILogger.warn(`OpenAI response missing type field: ${JSON.stringify(obj, null, 2)}`);
          throw ErrorFactory.openAIInvalidResponse('Response missing required type field');
        }
        
        // If reasoning is missing, add default reasoning based on operation type
        if (!obj.reasoning || typeof obj.reasoning !== 'string') {
          const operationDescriptions: Record<string, string> = {
            'create_file': 'Создание файла',
            'create_directory': 'Создание директории', 
            'write_file': 'Запись в файл',
            'delete_file': 'Удаление файла',
            'delete_directory': 'Удаление директории',
            'modify_file': 'Модификация файла',
            'copy_file': 'Копирование файла',
            'move_file': 'Перемещение файла',
            'rename_file': 'Переименование файла',
            'list_directory': 'Просмотр содержимого директории',
            'read_file': 'Чтение файла',
            'help': 'Справка',
            'explain': 'Объяснение команды',
            'undo': 'Отмена операции'
          };
          
          const defaultReasoning = operationDescriptions[obj.type as string] || 'Выполнение операции';
          obj.reasoning = defaultReasoning;
        }

        // Fix missing fields for modify_file operation
        if (obj.type === 'modify_file') {
          if (!obj.search || typeof obj.search !== 'string') {
            obj.search = '';  // Default empty search - will replace entire content
          }
          if (!obj.replace || typeof obj.replace !== 'string') {
            obj.replace = 'сделано!';  // Default content from user command
          }
          if (typeof obj.global !== 'boolean') {
            obj.global = false;  // Default to single replacement
          }
        }
        
        parsedResponse = obj;
      }

      // Validate against schema
      const validationResult = options.schema.safeParse(parsedResponse);

      if (!validationResult.success) {
        logOperationFailure(openAILogger, operationId, validationResult.error, {
          response: parsedResponse,
          errors: validationResult.error.errors,
        });
        throw ErrorFactory.openAIInvalidResponse('Response does not match expected schema');
      }

      logOperationSuccess(openAILogger, operationId, {
        validated: true,
      });

      return validationResult.data;
    } catch (error) {
      if (error instanceof Error && error.name.includes('CLIAgentError')) {
        throw error; // Re-throw our custom errors
      }

      logOperationFailure(openAILogger, operationId, error);
      throw ErrorFactory.unknown(error, { operation: operationId });
    }
  }

  /**
   * Create a streaming chat completion
   */
  async *chatCompletionStream(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const operationId = `chat_stream_${Date.now()}`;

    logOperationStart(openAILogger, operationId, {
      model: options.model || this.defaultModel,
      messageCount: messages.length,
    });

    try {
      const streamParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature ?? 1,
        ...(options.maxTokens && { max_tokens: options.maxTokens }),
        stream: true,
      };

      const stream = await this.client.chat.completions.create(streamParams);

      let totalContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          totalContent += content;
          yield content;
        }
      }

      logOperationSuccess(openAILogger, operationId, {
        totalLength: totalContent.length,
        streaming: true,
      });
    } catch (error) {
      logOperationFailure(openAILogger, operationId, error);

      if (error instanceof OpenAI.APIError) {
        switch (error.status) {
          case 401:
            throw ErrorFactory.openAIInvalidKey(error.message);
          case 429:
            throw ErrorFactory.openAIRateLimit();
          case 402:
            throw ErrorFactory.openAIQuotaExceeded();
          case 503:
          case 502:
          case 500:
            throw ErrorFactory.openAIServiceUnavailable(error.status);
          default:
            throw ErrorFactory.openAIInvalidResponse(error.message);
        }
      }

      throw ErrorFactory.unknown(error, { operation: operationId });
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    const operationId = 'get_models';

    logOperationStart(openAILogger, operationId);

    try {
      const response = await this.client.models.list();
      const modelIds = response.data.map(model => model.id);

      logOperationSuccess(openAILogger, operationId, {
        modelCount: modelIds.length,
      });

      return modelIds;
    } catch (error) {
      logOperationFailure(openAILogger, operationId, error);
      throw ErrorFactory.unknown(error, { operation: operationId });
    }
  }
}
