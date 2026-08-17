import { createPlan } from './planner';
import { analyzeProductivity } from './analyzer';
import { getLlmInsight } from './llmInsight';
import { generateRecommendation } from './recommender';
import { FocusSession } from '../models/FocusSession';

// ── Multi-Step Agent Orchestrator ─────────────────────────────────────────────
//
// This function is the entry point for the multi-stage productivity workflow.
//
// Stage flow (each stage consumes the previous stage's output):
//
//   1. Planner     → creates an analysis plan from the user's request
//   2. Analyzer    → computes structured metrics from the user's focus sessions
//   3. LLM Insight → sends metrics to Gemini; returns a structured interpretation
//   4. Recommender → combines metrics + LLM insight into a final recommendation
//
// The output of every stage becomes an explicit input to the next stage.
// All four artifacts are returned so the controller can expose them to the client.
//
// ─────────────────────────────────────────────────────────────────────────────

export async function runProductivityAgent(requestText: string, userId: string) {
  // ── Stage 1: Planner ───────────────────────────────────────────────────────
  // Converts the user's natural-language request into a small analysis plan.
  const plan = createPlan(requestText);

  // ── Stage 2: Analyzer ──────────────────────────────────────────────────────
  // Fetches recent focus sessions for the user and computes structured metrics.
  const sessions = await FocusSession.find({ userId }).limit(200).lean();
  const analysis = await analyzeProductivity(plan, sessions as any);

  // ── Stage 3: LLM Insight ───────────────────────────────────────────────────
  // Sends the structured metrics + user request to Gemini.
  // Returns a parsed { insight, priority, reason, source } object.
  // Falls back gracefully if the API key is missing or the call fails.
  const insight = await getLlmInsight(analysis, requestText);

  // ── Stage 4: Recommender ───────────────────────────────────────────────────
  // Combines the analyzer metrics with the LLM's interpretation to produce
  // the final, human-readable recommendation.
  const recommendation = await generateRecommendation(analysis, insight);

  return { plan, analysis, insight, recommendation };
}
