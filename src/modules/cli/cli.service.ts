import path from 'path';
import fs from 'fs/promises';
import { CommandHandler } from './handlers/command-handler';
import { DisplayHelper } from './display/display-helper';
import { PlanManager } from './planning/plan-manager';
import type { CommandIntent } from '../core/schemas/intent-schemas';

/**
 * CLI Service - main service for command-line interface
 * Coordinates all CLI-related functionality
 */
export class CLIService {
  private readonly commandHandler: CommandHandler;
  private readonly displayHelper: DisplayHelper;
  private readonly planManager: PlanManager;
  private readonly workspaceDirectory: string;
  private dryRunMode = false;
  private explainMode = false;
  private discussMode = false;

  constructor(workspaceDirectory?: string) {
    // Use workspace/ subdirectory for all file operations (security)
    this.workspaceDirectory = workspaceDirectory || path.join(process.cwd(), 'workspace');
    this.commandHandler = new CommandHandler(this.workspaceDirectory);
    this.planManager = new PlanManager(this.workspaceDirectory);
    this.displayHelper = new DisplayHelper(this.commandHandler.getBackupService());
  }

  /**
   * Initialize CLI service
   */
  async initialize(): Promise<void> {
    // Ensure workspace directory exists
    await this.ensureWorkspaceDirectory();
    await this.commandHandler.initialize();
  }

  /**
   * Ensure workspace directory exists
   */
  private async ensureWorkspaceDirectory(): Promise<void> {
    try {
      await fs.access(this.workspaceDirectory);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.workspaceDirectory, { recursive: true });
      console.log(`📁 Создана рабочая директория: ${this.workspaceDirectory}`);
    }
  }

  /**
   * Get workspace directory path
   */
  getWorkspaceDirectory(): string {
    return this.workspaceDirectory;
  }

  /**
   * Execute command in current mode
   */
  async executeCommand(
    intent: CommandIntent,
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    if (this.dryRunMode) {
      this.planManager.addOperation(intent);
      console.log(
        `\n📋 Операция добавлена в план (${this.planManager.getOperationCount()} операций)`
      );
      console.log('💡 Команды управления планом:');
      console.log('   "go" / "выполнить" - выполнить план');
      console.log('   "plan" / "план" - показать план');
      console.log('   "clear" / "очистить" - очистить план');
      console.log('   "dry-run" / "просмотр" - выключить режим просмотра');
    } else {
      if (intent.type === 'help') {
        this.displayHelper.showRussianHelp();
      } else {
        // In discuss mode, ask for confirmation for ALL operations (except help, explain, list_directory, read_file)
        const needsConfirmation = this.discussMode && this.isModifyingOperation(intent);
        
        if (needsConfirmation && confirmationCallback) {
          const confirmed = await confirmationCallback(
            `Выполнить операцию "${intent.type}" (${intent.reasoning || 'без описания'})?`
          );
          
          if (!confirmed) {
            console.log('❌ Операция отменена пользователем');
            return;
          }
        }
        
        await this.commandHandler.executeCommand(intent, confirmationCallback);
      }
    }
  }

  /**
   * Check if operation modifies filesystem (requires confirmation in discuss mode)
   */
  private isModifyingOperation(intent: CommandIntent): boolean {
    const readOnlyOperations = ['help', 'explain', 'list_directory', 'read_file'];
    return !readOnlyOperations.includes(intent.type);
  }

  /**
   * Execute all planned operations
   */
  async executePlannedOperations(
    confirmationCallback?: (_message: string) => Promise<boolean>
  ): Promise<void> {
    const operations = this.planManager.getOperations();
    console.log(`\n⚡ Выполнение плана из ${operations.length} операций...`);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (!operation) continue;

      console.log(`\n🔄 Операция ${i + 1}/${operations.length}: ${operation.type}`);

      try {
        await this.commandHandler.executeCommand(operation, confirmationCallback);
        successful++;
      } catch (error) {
        console.log(`❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }

    this.displayHelper.showPlanResults(successful, failed);
    this.planManager.clearPlan();
  }

  /**
   * Toggle dry-run mode
   */
  toggleDryRunMode(): boolean {
    this.dryRunMode = !this.dryRunMode;
    this.displayHelper.showModeToggle(
      'dry-run',
      this.dryRunMode,
      this.planManager.getOperationCount()
    );
    return this.dryRunMode;
  }

  /**
   * Toggle explain mode
   */
  toggleExplainMode(): boolean {
    this.explainMode = !this.explainMode;
    this.displayHelper.showModeToggle('explain', this.explainMode);
    return this.explainMode;
  }

  /**
   * Show current plan
   */
  async showPlan(): Promise<void> {
    if (this.planManager.isEmpty()) {
      console.log('📋 План пуст');
      return;
    }

    // Get detailed analysis
    const analysis = await this.planManager.getDetailedAnalysis();
    
    // Show detailed plan with analysis
    this.displayHelper.showDetailedPlan(analysis);
  }

  /**
   * Clear current plan
   */
  clearPlan(): number {
    const count = this.planManager.clearPlan();
    this.displayHelper.showPlanCleared(count);
    return count;
  }

  /**
   * Show operation history
   */
  showHistory(): void {
    this.displayHelper.showHistory();
  }

  /**
   * Show help
   */
  showHelp(): void {
    this.displayHelper.showRussianHelp();
  }

  /**
   * Show welcome message
   */
  showWelcome(sessionId: string): void {
    this.displayHelper.showWelcome(
      sessionId,
      this.workspaceDirectory,
      this.dryRunMode,
      this.explainMode,
      this.discussMode,
      this.planManager.getOperationCount()
    );
  }

  /**
   * Show explanation if explain mode is enabled
   */
  showExplanation(
    parseResult: { confidence?: number },
    intent: CommandIntent,
    sessionTokenUsage: { total: number }
  ): void {
    if (this.explainMode) {
      this.displayHelper.showExplanation(parseResult, intent, sessionTokenUsage);
    }
  }

  /**
   * Check if plan is empty
   */
  isPlanEmpty(): boolean {
    return this.planManager.isEmpty();
  }

  /**
   * Set modes
   */
  setDryRunMode(enabled: boolean): void {
    this.dryRunMode = enabled;
  }

  setExplainMode(enabled: boolean): void {
    this.explainMode = enabled;
  }

  setDiscussMode(enabled: boolean): void {
    this.discussMode = enabled;
  }

  /**
   * Get current modes
   */
  getModes(): { dryRun: boolean; explain: boolean; discuss: boolean } {
    return {
      dryRun: this.dryRunMode,
      explain: this.explainMode,
      discuss: this.discussMode,
    };
  }

  /**
   * Handle interruption (Ctrl+C) with potential rollback
   */
  async handleInterruption(): Promise<void> {
    await this.commandHandler.handleInterruption();
  }

  /**
   * Check if operation is currently running
   */
  isOperationRunning(): boolean {
    return this.commandHandler.isOperationRunning();
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    await this.commandHandler.getBackupService().cleanup();
  }
}
