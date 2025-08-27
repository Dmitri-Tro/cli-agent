/**
 * CLI Module
 *
 * Provides command-line interface functionality:
 * - Command execution and handling
 * - Interactive mode with planning capabilities
 * - Display and formatting utilities
 * - Operation history and undo support
 * - Multi-language command parsing
 */

// Main service
export { CLIService } from './cli.service';

// Command handling
export { CommandHandler } from './handlers/command-handler';

// Display utilities
export { DisplayHelper } from './display/display-helper';

// Planning
export { PlanManager } from './planning/plan-manager';
