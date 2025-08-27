import type { CommandIntent } from '../../core/schemas/intent-schemas';
import { PlanAnalyzer, type PlanAnalysis } from './plan-analyzer';

/**
 * Plan Manager - manages dry-run plans and operations queue
 * Handles operation planning for preview mode with detailed analysis
 */
export class PlanManager {
  private plannedOperations: CommandIntent[] = [];
  private readonly planAnalyzer: PlanAnalyzer;

  constructor(workingDirectory?: string) {
    this.planAnalyzer = new PlanAnalyzer(workingDirectory);
  }

  /**
   * Add operation to plan
   */
  addOperation(intent: CommandIntent): void {
    this.plannedOperations.push(intent);
  }

  /**
   * Get all planned operations
   */
  getOperations(): CommandIntent[] {
    return [...this.plannedOperations];
  }

  /**
   * Get number of planned operations
   */
  getOperationCount(): number {
    return this.plannedOperations.length;
  }

  /**
   * Clear all planned operations
   */
  clearPlan(): number {
    const count = this.plannedOperations.length;
    this.plannedOperations = [];
    return count;
  }

  /**
   * Check if plan is empty
   */
  isEmpty(): boolean {
    return this.plannedOperations.length === 0;
  }

  /**
   * Get operation by index
   */
  getOperation(index: number): CommandIntent | undefined {
    return this.plannedOperations[index];
  }

  /**
   * Remove operation by index
   */
  removeOperation(index: number): CommandIntent | undefined {
    if (index >= 0 && index < this.plannedOperations.length) {
      return this.plannedOperations.splice(index, 1)[0];
    }
    return undefined;
  }

  /**
   * Get plan summary for display
   */
  getPlanSummary(): string[] {
    return this.plannedOperations.map((op, index) => {
      return `${index + 1}. ${op.type}: ${op.reasoning}`;
    });
  }

  /**
   * Estimate cost of executing the plan (simple token estimation)
   */
  estimatePlanCost(): number {
    return this.plannedOperations.reduce((total, op) => {
      // Rough estimation: ~1 token per 3 characters for Russian text
      const opText = JSON.stringify(op);
      return total + Math.ceil(opText.length / 3);
    }, 0);
  }

  /**
   * Get detailed analysis of the current plan
   */
  async getDetailedAnalysis(): Promise<PlanAnalysis> {
    return this.planAnalyzer.analyzePlan(this.plannedOperations);
  }
}
