import { AnalysisResult } from './analyzer';
import { LlmInsight } from './llmInsight';

// ── Recommender ───────────────────────────────────────────────────────────────
//
// Stage 4 of the multi-step agent workflow.
//
// Receives BOTH the structured metrics (from the Analyzer, stage 2) AND the
// LLM's interpretation (from the LLM Insight stage, stage 3).
//
// This is what makes the recommendation richer than a pure heuristic:
// the LLM's reasoning is woven into the final output.
//
// Multi-step flow position:
//   Planner → Analyzer → LLM Insight → [Recommender]
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateRecommendation
 *
 * @param analysis - Structured metrics from the Analyzer stage.
 * @param insight  - Structured interpretation from the LLM Insight stage.
 * @returns        A human-readable recommendation string.
 */
export async function generateRecommendation(
  analysis: AnalysisResult,
  insight: LlmInsight,
): Promise<string> {
  const parts: string[] = [];

  // ── Part 1: raw metrics summary ───────────────────────────────────────────
  parts.push(
    `You had ${analysis.totalMinutes} minutes across ${analysis.sessionCount} sessions.`,
  );
  if (analysis.topTask) {
    parts.push(`Most focused on: ${analysis.topTask}.`);
  }

  // ── Part 2: LLM-derived insight woven in ─────────────────────────────────
  // The LLM insight (or fallback) is explicitly incorporated here,
  // making the recommender output dependent on stage 3's result.
  parts.push(`Insight: ${insight.insight}`);
  parts.push(`Focus priority → ${insight.priority}: ${insight.reason}`);

  // ── Part 3: heuristic nudge based on raw metrics ─────────────────────────
  if (analysis.sessionCount === 0) {
    parts.push('Try scheduling a single 25-minute focus session to start building momentum.');
  } else if (analysis.totalMinutes < 60) {
    parts.push('Aim for at least 3×25-min sessions this week to build a productivity baseline.');
  } else {
    parts.push('Consider blocking a morning for deep work on your top task.');
  }

  return parts.join(' ');
}
