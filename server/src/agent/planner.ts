export interface Plan {
  goals: string[];
  timeframe?: string;
}

/**
 * Simple deterministic planner that converts a user request
 * into a small analysis plan. This is intentionally tiny.
 */
export function createPlan(request: string): Plan {
  const lower = request.toLowerCase();
  const plan: Plan = { goals: [] };

  // Basic goals always useful for productivity analysis
  plan.goals.push('calculate total focus time');
  plan.goals.push('count sessions');
  plan.goals.push('identify most focused task');
  plan.goals.push('identify an area for improvement');

  // If user asks about a specific timeframe, record it
  if (lower.includes('week')) plan.timeframe = 'week';
  if (lower.includes('day')) plan.timeframe = 'day';

  return plan;
}
