/**
 * Planning Module
 *
 * Provides advanced planning and preview capabilities for CLI operations:
 * - Dry-run mode with operation queuing
 * - Plan management and execution
 * - Cost estimation and impact analysis
 * - Detailed filesystem impact analysis
 * - Conflict detection and warnings
 */

export { PlanManager } from './plan-manager';
export { PlanAnalyzer } from './plan-analyzer';
export type { PlanAnalysis, OperationImpact, FileState } from './plan-analyzer';
