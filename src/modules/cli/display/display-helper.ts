import type { BackupService } from '../../backup';
import type { CommandIntent } from '../../core/schemas/intent-schemas';
import type { PlanAnalysis } from '../planning/plan-analyzer';

/**
 * Display Helper - handles all console output and formatting
 * Provides consistent UI/UX for the CLI interface
 */
export class DisplayHelper {
  private readonly backupService: BackupService;

  constructor(backupService: BackupService) {
    this.backupService = backupService;
  }

  /**
   * Show welcome message
   */
  showWelcome(
    sessionId: string,
    workspaceDirectory: string,
    dryRunMode: boolean,
    explainMode: boolean,
    discussMode: boolean,
    planCount: number
  ): void {
    console.log('\n🤖 Добро пожаловать в CLI Agent!');
    console.log('Введите команды на русском языке. Наберите "помощь" для справки.');
    console.log('Для выхода используйте Ctrl+C или команду "выход"\n');

    console.log(`📊 Сессия: ${sessionId}`);
    console.log(`📁 Рабочая директория: ${workspaceDirectory}`);
    console.log(`${dryRunMode ? '🔍 Режим предварительного просмотра' : '⚡ Режим выполнения'}`);
    console.log(`${explainMode ? '🧠 Режим объяснений включен' : ''}`);
    console.log(`${discussMode ? '💭 Режим обсуждения включен - требуется подтверждение для всех операций' : ''}`);
    if (dryRunMode && planCount > 0) {
      console.log(`📋 Запланированных операций: ${planCount}`);
    }
    console.log('');
  }

  /**
   * Show operation history
   */
  showHistory(): void {
    console.log('\n📜 История операций:');
    const summary = this.backupService.getHistorySummary();

    if (summary.length === 0) {
      console.log('   Операций не выполнялось');
    } else {
      summary.forEach(line => console.log(`   ${line}`));
    }

    const stats = this.backupService.getStatistics();
    console.log(
      `\n📊 Статистика: ${stats.totalOperations} операций, ${stats.undoableOperations} можно отменить`
    );
  }

  /**
   * Show Russian help
   */
  showRussianHelp(): void {
    console.log(`
🤖 CLI Agent - Помощь

ОСНОВНЫЕ КОМАНДЫ:
  создай файл <путь>           - создать новый файл
  создай папку <путь>          - создать новую директорию
  запиши в <файл> <текст>      - записать текст в файл
  отмени                       - отменить последнюю операцию (только одну)
  помощь                       - показать эту справку

СИСТЕМНЫЕ КОМАНДЫ:
  история                      - показать историю операций
  просмотр / dry-run           - переключить режим предварительного просмотра
  объяснение / explain         - переключить режим детальных объяснений
  план / plan                  - показать текущий план операций
  выполнить / go               - выполнить запланированные операции
  очистить / clear             - очистить план операций
  выход                        - завершить работу

ПРИМЕРЫ:
  создай файл readme.md
  создай папку src/components
  запиши в config.json настройки сервера
  отмени

БЕЗОПАСНОСТЬ:
  • Все деструктивные операции создают резервные копии
  • Отмена операций работает последовательно (по одной за раз)
  • Работа только в текущей директории
  • Автоматическая очистка при выходе
`);
  }

  /**
   * Show mode toggle message
   */
  showModeToggle(mode: 'dry-run' | 'explain', enabled: boolean, planCount?: number): void {
    if (mode === 'dry-run') {
      console.log(`${enabled ? '🔍 Включен' : '⚡ Выключен'} режим предварительного просмотра`);
      if (enabled && planCount && planCount > 0) {
        console.log(`📋 В плане: ${planCount} операций`);
      }
    } else {
      console.log(`${enabled ? '🧠 Включен' : '⚡ Выключен'} режим объяснений`);
    }
  }

  /**
   * Show plan cleared message
   */
  showPlanCleared(count: number): void {
    console.log(`🗑️  Очищен план из ${count} операций`);
  }

  /**
   * Show plan execution results
   */
  showPlanResults(successful: number, failed: number): void {
    console.log(`\n📊 Результат выполнения плана:`);
    console.log(`   ✅ Успешно: ${successful}`);
    console.log(`   ❌ Ошибок: ${failed}`);
  }

  /**
   * Show current plan
   */
  showPlan(planSummary: string[], estimatedCost: number): void {
    if (planSummary.length === 0) {
      console.log('📋 План пуст');
      return;
    }

    console.log(`\n📋 Текущий план (${planSummary.length} операций):`);
    planSummary.forEach(line => {
      console.log(`   ${line}`);
    });

    console.log(`💰 Примерная стоимость выполнения: ${estimatedCost} токенов`);
  }

  /**
   * Show detailed plan analysis with impact assessment
   */
  showDetailedPlan(analysis: PlanAnalysis): void {
    console.log(`\n📋 Детальный план анализа (${analysis.totalOperations} операций)`);
    
    // Show summary
    this.showPlanSummary(analysis);
    
    // Show conflicts and warnings first
    this.showConflictsAndWarnings(analysis);
    
    // Show detailed operation analysis
    this.showOperationDetails(analysis);
    
    // Show filesystem impact
    this.showFilesystemImpact(analysis);
    
    console.log('\n💡 Команды управления планом:');
    console.log('   "go" / "выполнить" - выполнить весь план после подтверждения');
    console.log('   "clear" / "очистить" - очистить план');
    console.log('   "dry-run" / "просмотр" - выключить режим планирования');
  }

  /**
   * Show plan summary statistics
   */
  private showPlanSummary(analysis: PlanAnalysis): void {
    const { summary } = analysis;
    console.log('\n📊 Сводка операций:');
    
    if (summary.creates > 0) console.log(`   ✨ Создание: ${summary.creates}`);
    if (summary.modifies > 0) console.log(`   ✏️  Изменение: ${summary.modifies}`);
    if (summary.deletes > 0) console.log(`   🗑️  Удаление: ${summary.deletes}`);
    if (summary.moves > 0) console.log(`   📦 Перемещение: ${summary.moves}`);
    if (summary.reads > 0) console.log(`   👀 Чтение: ${summary.reads}`);
  }

  /**
   * Show conflicts and warnings
   */
  private showConflictsAndWarnings(analysis: PlanAnalysis): void {
    if (analysis.conflicts.length > 0) {
      console.log('\n⚠️ Конфликты:');
      analysis.conflicts.forEach(conflict => {
        console.log(`   ❌ ${conflict}`);
      });
    }

    if (analysis.warnings.length > 0) {
      console.log('\n⚠️ Предупреждения:');
      analysis.warnings.forEach(warning => {
        console.log(`   🔸 ${warning}`);
      });
    }
  }

  /**
   * Show detailed operation analysis
   */
  private showOperationDetails(analysis: PlanAnalysis): void {
    console.log('\n🔍 Детальный анализ операций:');
    
    analysis.operations.forEach((impact, index) => {
      console.log(`\n${index + 1}. ${this.getOperationIcon(impact.impactType)} ${impact.operation.type}`);
      console.log(`   📍 Путь: ${impact.targetPath}`);
      console.log(`   💭 Обоснование: ${impact.operation.reasoning || 'Не указано'}`);
      
      if (impact.beforeState?.exists) {
        const type = impact.beforeState.isDirectory ? 'директория' : 'файл';
        const size = impact.beforeState.size ? ` (${this.formatFileSize(impact.beforeState.size)})` : '';
        console.log(`   📄 Текущее состояние: ${type}${size}`);
      } else {
        console.log(`   📄 Текущее состояние: не существует`);
      }

      if (impact.afterState) {
        const type = impact.afterState.isDirectory ? 'директория' : 'файл';
        const size = impact.afterState.size ? ` (${this.formatFileSize(impact.afterState.size)})` : '';
        const exists = impact.afterState.exists ? `${type}${size}` : 'будет удален';
        console.log(`   🎯 После операции: ${exists}`);
      }

      if (impact.affectedFiles.length > 0) {
        console.log(`   🔗 Затронутые файлы: ${impact.affectedFiles.join(', ')}`);
      }
    });
  }

  /**
   * Show filesystem impact comparison
   */
  private showFilesystemImpact(analysis: PlanAnalysis): void {
    console.log('\n🌳 Влияние на файловую структуру:');
    
    // Count changes
    let newFiles = 0;
    let modifiedFiles = 0;
    let deletedFiles = 0;

    for (const [path, afterState] of analysis.filesystemAfter) {
      const beforeState = analysis.filesystemBefore.get(path);
      
      if (!beforeState?.exists && afterState.exists) {
        newFiles++;
      } else if (beforeState?.exists && !afterState.exists) {
        deletedFiles++;
      } else if (beforeState?.exists && afterState.exists) {
        // Check if modified (simplified check)
        if (beforeState.size !== afterState.size) {
          modifiedFiles++;
        }
      }
    }

    console.log(`   ✨ Новые элементы: ${newFiles}`);
    console.log(`   ✏️  Изменённые элементы: ${modifiedFiles}`);
    console.log(`   🗑️  Удалённые элементы: ${deletedFiles}`);

    // Show structure preview if not too large
    if (analysis.filesystemAfter.size <= 20) {
      this.showFilesystemStructure(analysis);
    } else {
      console.log('\n📁 Структура файловой системы слишком велика для отображения');
    }
  }

  /**
   * Show filesystem structure tree
   */
  private showFilesystemStructure(analysis: PlanAnalysis): void {
    console.log('\n📁 Предварительная структура:');
    
    const paths = Array.from(analysis.filesystemAfter.keys())
      .filter(path => analysis.filesystemAfter.get(path)?.exists)
      .sort();

    for (const filePath of paths) {
      const state = analysis.filesystemAfter.get(filePath);
      if (!state?.exists) continue;

      const beforeState = analysis.filesystemBefore.get(filePath);
      const isNew = !beforeState?.exists;
      const isModified = beforeState?.exists && beforeState.size !== state.size;
      
      const icon = state.isDirectory ? '📁' : '📄';
      const status = isNew ? ' ✨' : isModified ? ' ✏️' : '';
      const size = state.size ? ` (${this.formatFileSize(state.size)})` : '';
      
      console.log(`   ${icon} ${filePath}${size}${status}`);
    }
  }

  /**
   * Get operation type icon
   */
  private getOperationIcon(impactType: string): string {
    switch (impactType) {
      case 'create': return '✨';
      case 'modify': return '✏️';
      case 'delete': return '🗑️';
      case 'move': return '📦';
      case 'read': return '👀';
      default: return '🔧';
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Show explanation of AI interpretation
   */
  showExplanation(
    parseResult: { confidence?: number },
    intent: CommandIntent,
    sessionTokenUsage: { total: number }
  ): void {
    console.log('\n🧠 Детальное объяснение:');
    console.log(`   🎯 Тип операции: ${intent.type}`);
    console.log(`   💭 Обоснование: ${intent.reasoning}`);

    if ('confidence' in parseResult) {
      console.log(`   📊 Уверенность: ${(parseResult.confidence! * 100).toFixed(1)}%`);
    }

    const estimatedTokens = this.estimateTokens(JSON.stringify(intent));
    console.log(`   🔢 Примерное использование токенов: ${estimatedTokens}`);
    console.log(`   📈 Общее использование за сессию: ${sessionTokenUsage.total} токенов`);
  }

  /**
   * Estimate token usage for operation
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~1 token per 3 characters for Russian text
    return Math.ceil(text.length / 3);
  }
}
