import readline from 'readline';
import { CLIService } from './modules/cli/cli.service';
import { envValidated } from './config/env-validator';
import { EncodingSystem } from './lib/encoding-system';
import { OpenAIClient } from './modules/core/ai/openai-client';
import { CommandIntentSchema, CommandIntent } from './modules/core/schemas/intent-schemas';
import { CLIAgentError, ErrorFactory, errorHandler } from './modules/core/errors';
import { createLogger } from './modules/core/logging/logger';

const logger = createLogger({ level: 'info', component: 'ModularCommandParser' });

interface ICommandParser {
  parseCommand(_command: string): Promise<{ intent: CommandIntent; confidence?: number }>;
}

class ModularCommandParser implements ICommandParser {
  private openAIClient: OpenAIClient;

  constructor() {
    this.openAIClient = new OpenAIClient({
      apiKey: envValidated.OPENAI_API_KEY,
      defaultModel: 'gpt-4o-mini',
    });
  }

  async parseCommand(userCommand: string): Promise<{ intent: CommandIntent; confidence?: number }> {
    const systemPrompt = `
You are a CLI command parser. Parse Russian file system commands and return JSON with ENGLISH paths only.

CRITICAL: You MUST return valid JSON with a "type" field. NEVER return error objects or {"error": "..."}.
If you cannot parse a command, choose the closest valid command type.

ENCODING & PARSING RULES:
1. Translate ALL Russian path words to English
2. Keep "reasoning" field in Russian for user
3. Return ONLY valid JSON
4. Use English paths to prevent encoding issues

TRANSLATION MAP (Russian -> English):
- тест -> test
- папка -> folder  
- файл -> file
- текст -> text
- ййй -> yyy
- новый -> new
- содержимое -> content
- документ -> document
- кенг -> keng
- проект -> project

CRITICAL PARSING RULES FOR "в папке X" AND MOVE OPERATIONS:
- "создай папку Y в папке X" -> path should be "X/Y" (not "folder/Y")
- First identify the target directory name after "в папке"
- Then combine with the item being created
- Example: "создай папку кенг в папке тест" -> "test/keng"

MOVE/ПЕРЕМЕСТИ OPERATIONS:
- "перемести файл A в папку X" -> sourcePath: "A", destinationPath: "X/A" (folder + filename)
- "перемести файл docs/file.txt в папку src" -> sourcePath: "docs/file.txt", destinationPath: "src/file.txt"  
- "перемести файл A в B" -> sourcePath: "A", destinationPath: "B/A" (B is folder)
- Extract filename from sourcePath and combine with destination folder

SUPPORTED OPERATIONS:
- create_file: path, content (optional), overwrite, reasoning
- create_directory: path, recursive, reasoning  
- write_file: path, content, overwrite, reasoning
- read_file: path, reasoning
- delete_file: path, confirm, reasoning
- delete_directory: path, recursive, confirm, reasoning
- modify_file: path, search, replace, global, reasoning
- copy_file: sourcePath, destinationPath, overwrite, reasoning
- move_file: sourcePath, destinationPath, overwrite, reasoning
- rename_file: path, newName, overwrite, reasoning (works for both files and directories)
- list_directory: path, reasoning
- help: reasoning
- undo: reasoning
- explain: reasoning

CONTENT EXTRACTION RULES:
- "создай файл X с текстом Y" → extract Y as content field
- "создай файл X с содержимым Y" → extract Y as content field
- "создай файл X" → content = "" (empty string)

MOVE OPERATION RULES:
1. NEVER make sourcePath = destinationPath
2. "перемести файл X в папку Y" = extract filename from X, combine with directory Y
3. Translate paths: тест/файл.txt -> test/file.txt

FIELD REQUIREMENTS (English paths):
- For move_file/copy_file: use "sourcePath" and "destinationPath"
- For create_file/move_file/copy_file: use "overwrite" (boolean)
- For delete operations: use "confirm" (boolean)`;

    const userPrompt = `Parse this Russian command: "${userCommand}"

EXAMPLES WITH ENGLISH PATHS:

Input: "создай файл тест/новый.txt"
Output: {"type": "create_file", "path": "test/new.txt", "content": "", "overwrite": false, "reasoning": "Создание файла test/new.txt"}

Input: "создай папку кенг в папке тест"
Output: {"type": "create_directory", "path": "test/keng", "recursive": false, "reasoning": "Создание папки keng в папке test"}

Input: "создай файл readme.md в папке docs"
Output: {"type": "create_file", "path": "docs/readme.md", "content": "", "overwrite": false, "reasoning": "Создание файла readme.md в папке docs"}

Input: "создай файл hello.txt с текстом "Привет мир""
Output: {"type": "create_file", "path": "hello.txt", "content": "Привет мир", "overwrite": false, "reasoning": "Создание файла hello.txt с содержимым"}

Input: "запиши в файл тест/данные.txt содержимое файла"
Output: {"type": "write_file", "path": "test/data.txt", "content": "содержимое файла", "overwrite": true, "reasoning": "Запись в файл test/data.txt"}

Input: "перемести файл папка/текст.txt в папку тест"  
Output: {"type": "move_file", "sourcePath": "folder/text.txt", "destinationPath": "test/text.txt", "overwrite": false, "reasoning": "Перемещение файла folder/text.txt в папку test"}

Input: "удали файлтест.txt" (no space)
Output: {"type": "delete_file", "path": "test.txt", "confirm": true, "reasoning": "Удаление файла test.txt"}

Input: "перепиши файл тест/ййй.txt привет"
Output: {"type": "modify_file", "path": "test/yyy.txt", "search": "", "replace": "привет", "global": false, "reasoning": "Полная перезапись файла test/yyy.txt содержимым 'привет'"}

Input: "переименуй файл старое.txt в новое.txt"
Output: {"type": "rename_file", "path": "old.txt", "newName": "new.txt", "overwrite": false, "reasoning": "Переименование файла old.txt в new.txt"}

Input: "переименуй папку старая в новая"
Output: {"type": "rename_file", "path": "old", "newName": "new", "overwrite": false, "reasoning": "Переименование папки old в new"}

CRITICAL RULES:
1. Translate Russian words in paths to English
2. Keep "reasoning" in Russian 
3. For move operations: NEVER make sourcePath = destinationPath
4. For "в папке Y": extract target name from "в папке", combine with item being created
5. Commands without spaces: "удалифайлX" -> treat as "удали файл X"
6. NESTED DIRECTORIES: "создай папку X в папке Y" -> path = "Y/X" (translate Y to English)

Return ONLY valid JSON with a "type" field. NEVER return {"error": "..."} objects.`;

    try {
      const response = await this.openAIClient.chatJSON({
        systemPrompt,
        userPrompt,
        schema: CommandIntentSchema,
      });

      return { intent: response };
    } catch (error) {
      logger.error({ error, userCommand }, 'Error parsing command');
      
      if (error instanceof CLIAgentError) {
        throw error;
      }

      throw ErrorFactory.openAIInvalidResponse(error);
    }
  }
}

class ModularCLIApplication {
  private cliService: CLIService;
  private parser: ModularCommandParser;

  constructor() {
    this.cliService = new CLIService();
    this.parser = new ModularCommandParser();
  }

  async processCommand(userCommand: string): Promise<void> {
    try {
      // Process user command directly (encoding is now handled at console level)
      
      const { intent } = await this.parser.parseCommand(userCommand);
      
      // Add default reasoning if missing (BUG-001 fallback)
      if (!intent.reasoning || typeof intent.reasoning !== 'string') {
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

        const defaultReasoning = operationDescriptions[intent.type] || 'Выполнение операции';
        intent.reasoning = defaultReasoning;
      }

      await this.cliService.executeCommand(intent);
    } catch (error) {
      await errorHandler.handleError(error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.cliService.initialize();
      
      // Parse command line arguments for modes
      const args = process.argv.slice(2);
      const isDryRun = args.includes('--dry-run') || args.includes('--plan');
      const isExplain = args.includes('--explain');
      const isDiscuss = args.includes('--discuss');
      
      // Set modes in CLI service
      if (isDryRun) this.cliService.setDryRunMode(true);
      if (isExplain) this.cliService.setExplainMode(true);
      if (isDiscuss) this.cliService.setDiscussMode(true);
      
      await this.startInteractiveMode();
    } catch (error) {
      await errorHandler.handleError(error);
      process.exit(1);
    }
  }

  private async startInteractiveMode(): Promise<void> {
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 CLI Agent > '
    });

    // Show welcome message - use built-in welcome method
    const sessionId = 'interactive-session';
    const workspaceDir = this.cliService.getWorkspaceDirectory();
    const modes = this.cliService.getModes();
    
    console.log('\n🤖 Добро пожаловать в CLI Agent!');
    console.log('Введите команды на русском языке. Наберите "помощь" для справки.');
    console.log('Для выхода используйте Ctrl+C или команду "выход"\n');
    
    console.log(`📊 Сессия: ${sessionId}`);
    console.log(`📁 Рабочая директория: ${workspaceDir}`);
    console.log(`${modes.dryRun ? '🔍 Режим предварительного просмотра' : '⚡ Режим выполнения'}`);
    console.log(`${modes.explain ? '🧠 Режим объяснений включен' : ''}`);
    console.log(`${modes.discuss ? '💭 Режим обсуждения включен - требуется подтверждение для всех операций' : ''}`);
    console.log('');

    // Confirmation helper
    const askConfirmation = (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        rl.question(`❓ ${message} (y/n): `, (answer) => {
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'да');
        });
      });
    };

    // Handle Ctrl+C gracefully
    rl.on('SIGINT', async () => {
      console.log('\n👋 Завершение работы...');
      if (this.cliService.isOperationRunning()) {
        console.log('⚠️  Прерывание активной операции...');
        await this.cliService.handleInterruption();
      }
      await this.cliService.cleanup();
      rl.close();
      process.exit(0);
    });

    // Process user input
    rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        rl.prompt();
        return;
      }

      // Handle exit commands
      if (['выход', 'exit', 'quit', 'bye'].includes(trimmedInput.toLowerCase())) {
        console.log('👋 До свидания!');
        await this.cliService.cleanup();
        rl.close();
        process.exit(0);
      }

      // Handle plan management commands
      if (['go', 'выполнить', 'execute'].includes(trimmedInput.toLowerCase())) {
        await this.cliService.executePlannedOperations(askConfirmation);
        rl.prompt();
        return;
      }

      if (['plan', 'план', 'show-plan'].includes(trimmedInput.toLowerCase())) {
        await this.cliService.showPlan();
        rl.prompt();
        return;
      }

      if (['clear', 'очистить', 'clear-plan'].includes(trimmedInput.toLowerCase())) {
        this.cliService.clearPlan();
        rl.prompt();
        return;
      }

      // Skip OpenAI parsing for simple confirmation responses
      if (['y', 'n', 'да', 'нет', 'yes', 'no'].includes(trimmedInput.toLowerCase())) {
        console.log(`❌ Непонятная команда "${trimmedInput}". Используйте полные команды или "помощь".`);
        rl.prompt();
        return;
      }

      try {
        // Parse command using AI
        const { intent } = await this.parser.parseCommand(trimmedInput);
        
        // Execute command through CLI service
        await this.cliService.executeCommand(intent, askConfirmation);
        
      } catch (error) {
        await errorHandler.handleError(error);
      }
      
      rl.prompt();
    });

    // Start prompting
    rl.prompt();
  }
}

async function main(): Promise<void> {
  // Setup proper console encoding for Russian text
  EncodingSystem.setupConsoleEncoding();
  
  const app = new ModularCLIApplication();
  await app.start();
}

// Only run if this module is the main entry point
if (require.main === module) {
  main().catch((error) => {
    console.error('Application failed to start:', error);
    process.exit(1);
  });
}

export { ModularCLIApplication, ModularCommandParser };
