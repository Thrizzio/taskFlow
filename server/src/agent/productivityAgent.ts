import { createPlan } from './planner';
import { analyzeProductivity } from './analyzer';
import { generateRecommendation } from './recommender';
import { FocusSession } from '../models/FocusSession';

export async function runProductivityAgent(requestText: string, userId: string) {
  // Step 1: Planner
  const plan = createPlan(requestText);

  // Step 2: Analyzer - fetch user's recent focus sessions (simple + small)
  const sessions = await FocusSession.find({ userId }).limit(200).lean();
  const analysis = await analyzeProductivity(plan, sessions as any);

  // Step 3: Recommendation generator
  const recommendation = await generateRecommendation(requestText, plan, analysis);

  return { plan, analysis, recommendation };
}
