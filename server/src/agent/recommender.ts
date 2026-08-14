import { Plan } from './planner';
import { AnalysisResult } from './analyzer';

/**
 * Generate a short recommendation. This is deterministic for now
 * but kept separate so it can later call an LLM service.
 */
export async function generateRecommendation(request: string, plan: Plan, analysis: AnalysisResult): Promise<string> {
  const parts: string[] = [];
  parts.push(`You had ${analysis.totalMinutes} minutes across ${analysis.sessionCount} sessions.`);
  if (analysis.topTask) parts.push(`Most focused on: ${analysis.topTask}.`);

  // Simple heuristic suggestions
  if (analysis.sessionCount === 0) {
    parts.push('No sessions found: try scheduling a single 25-minute focus session this week.');
  } else if (analysis.totalMinutes < 60) {
    parts.push('Total focus time is low; aim for at least 3×25min sessions per week.');
  } else {
    parts.push('Nice work — consider blocking a morning for deep work on your top task.');
  }

  return parts.join(' ');
}
