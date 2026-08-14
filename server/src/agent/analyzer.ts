import { Task } from '../models/Task';
import { Plan } from './planner';

export interface AnalysisResult {
  totalMinutes: number;
  sessionCount: number;
  topTask?: string;
}

/**
 * Analyze sessions according to a simple plan.
 * Queries DB for task titles when needed.
 */
export async function analyzeProductivity(plan: Plan, sessions: any[]): Promise<AnalysisResult> {
  // sessions here are plain objects (from .lean()) or Mongoose docs
  const sessionCount = sessions.length;
  const totalMinutes = sessions.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);

  // Determine top task by accumulated duration
  const byTask = new Map<string, number>();
  for (const s of sessions) {
    const t = String(s.taskId);
    byTask.set(t, (byTask.get(t) || 0) + (s.duration || 0));
  }

  let topTask: string | undefined;
  if (byTask.size > 0) {
    const topTaskId = Array.from(byTask.entries()).sort((a, b) => b[1] - a[1])[0][0];
    try {
      const task = await Task.findById(topTaskId).lean();
      topTask = task?.title || topTaskId;
    } catch (err) {
      topTask = topTaskId;
    }
  }

  return { totalMinutes, sessionCount, topTask };
}
