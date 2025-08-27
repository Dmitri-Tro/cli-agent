/**
 * AI Prompt Optimizer for Enhanced Command Parsing
 * Provides context-aware and adaptive prompts for better command recognition
 */

export interface PromptContext {
  recentCommands: string[] | undefined;
  currentWorkspace: string | undefined;
  lastOperation: string | undefined;
  userPreferences: {
    verbosity: 'low' | 'medium' | 'high';
    confirmDestructive: boolean;
  } | undefined;
}

export interface EnhancedParseResult {
  intent: unknown; // Will be typed properly
  confidence: number; // 0-1 scale
  alternatives: unknown[] | undefined; // Alternative interpretations
  reasoning: string;
  suggestedFollowup: string | undefined;
}

/**
 * Advanced prompt generator with context awareness
 */
export class PromptOptimizer {
  
  /**
   * Generate context-aware system prompt
   */
  static generateSystemPrompt(context?: PromptContext): string {
    const basePrompt = `
Ты экспертный парсер команд для CLI агента. Анализируй команды на русском языке и возвращай JSON с ОДНОЙ операцией.

🎯 КОНТЕКСТНОЕ ПОНИМАНИЕ:
- Учитывай контекст файловой системы
- Различай файлы и директории по расширениям и контексту
- Понимай намерения пользователя через ключевые слова
- Предугадывай следующие возможные действия

🚨 КРИТИЧЕСКИЕ ПРАВИЛА:
1. Возвращай ТОЛЬКО ОДНУ операцию - никогда массивы или множественные операции
2. Русский/кириллический текст ДОЛЖЕН копироваться символ-в-символ как есть
3. НИКОГДА не преобразовывай и не кодируй кириллические символы
4. Слово "тест" должно остаться "тест" в JSON, НЕ "ÐéðÁÐüÐé" или похожий искаженный текст
5. Сохраняй UTF-8 кодировку точно как получено

🧠 УМНОЕ РАЗЛИЧЕНИЕ ФАЙЛОВ И ДИРЕКТОРИЙ:
- "удали папку X", "создай папку X", путь без расширения → directory операции
- "удали файл X", "создай файл X", путь с расширением → file операции  
- "удали X" без уточнения → анализируй контекст:
  * Если X имеет расширение (.txt, .js, etc.) → delete_file
  * Если X без расширения или явно папка → delete_directory
  * При сомнении - спроси уточнение через explain

📁 КОНТЕКСТНЫЕ ПОДСКАЗКИ:
- При создании файла в несуществующей папке - предложи создать папку
- При операциях в глубоких путях - проверь существование родительских папок
- При удалении - учитывай возможные зависимости`;

    // Add context-specific enhancements
    if (context?.recentCommands?.length) {
      const recentOps = context.recentCommands.slice(-3).join(', ');
      return basePrompt + `

🔄 КОНТЕКСТ ПОСЛЕДНИХ КОМАНД: ${recentOps}
- Учитывай логическую последовательность операций
- Если пользователь создавал структуру, возможно продолжает работу в том же направлении`;
    }

    if (context?.lastOperation) {
      return basePrompt + `

⏮️ ПРЕДЫДУЩАЯ ОПЕРАЦИЯ: ${context.lastOperation}
- Учитывай связь с предыдущим действием
- Возможно пользователь продолжает работу в том же контексте`;
    }

    return basePrompt + this.getOperationTypesDocumentation();
  }

  /**
   * Generate enhanced user prompt with confidence indicators
   */
  static generateUserPrompt(command: string, _context?: PromptContext): string {
    return `
КОМАНДА ПОЛЬЗОВАТЕЛЯ: "${command}"

🚨 КОДИРОВКА: ВЕСЬ кириллический текст должен быть сохранен точно как есть
❌ НЕПРАВИЛЬНО: "ÐéðÁÐüÐé", "ÐåÐåÐå", искаженные символы, массивы, множественные операции  
✅ ПРАВИЛЬНО: Одна операция с точным UTF-8 кириллическим текстом

🎯 ТРЕБОВАНИЯ К АНАЛИЗУ:
1. Определи ОСНОВНОЕ намерение пользователя
2. Выбери НАИБОЛЕЕ ПОДХОДЯЩИЙ тип операции
3. Заполни ВСЕ ОБЯЗАТЕЛЬНЫЕ поля для выбранной операции
4. Добавь разумные значения по умолчанию где необходимо

💡 ПОДСКАЗКИ ДЛЯ НЕОДНОЗНАЧНОСТИ:
- Если команда может означать несколько действий - выбери наиболее логичное
- Если не хватает информации для выполнения - используй explain с вопросом
- Если путь неясен - предположи разумный путь в рабочей директории

Верни JSON операцию:`;
  }

  /**
   * Operations documentation for prompt
   */
  private static getOperationTypesDocumentation(): string {
    return `

📋 ТИПЫ ОПЕРАЦИЙ (выбери ОДНУ):

📁 ФАЙЛОВЫЕ ОПЕРАЦИИ:
- create_file: создание файла (type, path, overwrite, reasoning; опционально: content)
- write_file: запись в файл (type, path, content, mode, reasoning)
- read_file: чтение файла (type, path, reasoning)
- delete_file: удаление файла (type, path, confirm, reasoning)
- modify_file: модификация файла
- copy_file: копирование файла (type, sourcePath, destinationPath, overwrite, reasoning)
- move_file: перемещение файла (type, sourcePath, destinationPath, overwrite, reasoning)
- rename_file: переименование файла (type, path, newName, overwrite, reasoning)

📂 ДИРЕКТОРИИ:
- create_directory: создание директории (type, path, recursive, reasoning)
- delete_directory: удаление директории (type, path, recursive, confirm, reasoning)
- list_directory: просмотр содержимого директории (type, path, reasoning)

🔧 СИСТЕМНЫЕ:
- undo: отмена операций (type, reasoning)
- help: помощь (type, reasoning)
- explain: объяснение (type, message, reasoning)

⚠️ ВАЖНЫЕ ИМЕНА ПОЛЕЙ:
- Для move_file/copy_file: используй "sourcePath" и "destinationPath" (НЕ "src"/"dest")
- Для create_file/move_file/copy_file: используй "overwrite" (boolean)
- Для delete операций: используй "confirm" (boolean)
- Для create_directory: используй "recursive" (boolean)

📌 ПРИМЕРЫ:
- Перемещение файла: {"type": "move_file", "sourcePath": "папка1/файл.txt", "destinationPath": "папка2/файл.txt", "overwrite": false}
- Перемещение директории: {"type": "move_file", "sourcePath": "старая_папка", "destinationPath": "новая_папка", "overwrite": false}
- Создание файла: {"type": "create_file", "path": "тест/файл.txt", "overwrite": false, "reasoning": "Создание файла в папке тест"}`;
  }

  /**
   * Analyze confidence based on command characteristics
   */
  static analyzeConfidence(command: string, result: unknown): number {
    let confidence = 0.5; // Base confidence

    // Clear operation indicators
    const clearIndicators = [
      'создай', 'создать', 'удали', 'удалить', 'копируй', 'скопировать',
      'перемести', 'переместить', 'переименуй', 'переименовать',
      'покажи', 'показать', 'прочитай', 'прочитать'
    ];

    if (clearIndicators.some(indicator => command.toLowerCase().includes(indicator))) {
      confidence += 0.3;
    }

    // Path clarity
    if (command.includes('/') || command.includes('\\') || /\.[a-zA-Z]+/.test(command)) {
      confidence += 0.2;
    }

    // File/directory indicators
    const fileIndicators = ['файл', 'file', '.txt', '.js', '.json', '.md'];
    const dirIndicators = ['папк', 'директор', 'folder', 'dir'];
    
    if (fileIndicators.some(ind => command.toLowerCase().includes(ind))) {
      confidence += 0.1;
    }
    if (dirIndicators.some(ind => command.toLowerCase().includes(ind))) {
      confidence += 0.1;
    }

    // Specific operation confidence
    const typedResult = result as Record<string, unknown>;
    if (typedResult?.type) {
      switch (typedResult.type) {
        case 'help':
        case 'undo':
          confidence = Math.max(confidence, 0.9);
          break;
        case 'explain':
          confidence = Math.max(confidence, 0.7);
          break;
        default:
          break;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate alternative interpretations for ambiguous commands
   */
  static generateAlternatives(command: string, primaryResult: unknown): unknown[] {
    const alternatives: unknown[] = [];

    // If primary is file operation, consider directory alternative
    const typedPrimary = primaryResult as Record<string, unknown>;
    if (typedPrimary?.type === 'delete_file') {
      alternatives.push({
        type: 'delete_directory',
        path: typedPrimary.path,
        recursive: true,
        confirm: true,
        reasoning: `Альтернатива: удаление как директории`
      });
    }

    if (typedPrimary?.type === 'create_file') {
      alternatives.push({
        type: 'create_directory',
        path: typedPrimary.path,
        recursive: true,
        reasoning: `Альтернатива: создание как директории`
      });
    }

    return alternatives;
  }

  /**
   * Suggest logical follow-up actions
   */
  static suggestFollowup(result: unknown): string | undefined {
    const typedResult = result as Record<string, unknown>;
    switch (typedResult?.type) {
      case 'create_directory':
        return 'Создать файл в новой директории?';
      case 'create_file':
        return 'Открыть файл для редактирования?';
      case 'delete_file':
      case 'delete_directory':
        return 'Выполнить очистку или создать замену?';
      case 'copy_file':
        return 'Отредактировать скопированный файл?';
      default:
        return undefined;
    }
  }
}
