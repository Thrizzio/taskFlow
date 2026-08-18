/**
 * LLM Evaluation Dataset
 *
 * Each case defines:
 *   - userRequest  : the natural-language input the user sends to the agent
 *   - mockAnalysis : a synthetic AnalysisResult used instead of real DB data
 *                    so the eval is deterministic and never touches production data
 *   - criteria     : what the returned LlmInsight must satisfy to pass
 *
 * Criteria are intentionally non-exact: LLMs are non-deterministic, so we check
 * semantic properties (non-empty strings, expected priority keyword, correct
 * source flag) rather than exact string matches.
 */

import { AnalysisResult } from '../analyzer';

export interface EvalCriteria {
    /** insight must be a non-empty string */
    insightNonEmpty: true;
    /** reason must be a non-empty string */
    reasonNonEmpty: true;
    /** The `priority` field must contain one of these strings (case-insensitive) */
    priorityContainsOneOf: string[];
    /** The `source` field must be one of these values */
    sourceIs: Array<'llm' | 'fallback'>;
}

export interface EvalCase {
    id: string;
    description: string;
    userRequest: string;
    mockAnalysis: AnalysisResult;
    criteria: EvalCriteria;
}

export const evalCases: EvalCase[] = [
    {
        id: 'eval-01',
        description: 'New user with zero sessions — agent should prompt them to start.',
        userRequest: 'How is my productivity looking?',
        mockAnalysis: {
            totalMinutes: 0,
            sessionCount: 0,
            topTask: undefined,
        },
        criteria: {
            insightNonEmpty: true,
            reasonNonEmpty: true,
            // Either the LLM or the fallback should suggest starting/beginning
            priorityContainsOneOf: ['start', 'begin', 'volume', 'consistency'],
            sourceIs: ['llm', 'fallback'],
        },
    },
    {
        id: 'eval-02',
        description: 'Low-volume user — agent should recommend increasing focus time.',
        userRequest: 'Give me productivity recommendations.',
        mockAnalysis: {
            totalMinutes: 30,
            sessionCount: 2,
            topTask: 'Math Assignment',
        },
        criteria: {
            insightNonEmpty: true,
            reasonNonEmpty: true,
            // Low volume should push toward volume or time-related priority
            priorityContainsOneOf: ['volume', 'time', 'more', 'increase', 'focus', 'start'],
            sourceIs: ['llm', 'fallback'],
        },
    },
    {
        id: 'eval-03',
        description: 'High-volume user — agent should focus on consistency or deep work.',
        userRequest: 'What should I improve in my study routine?',
        mockAnalysis: {
            totalMinutes: 150,
            sessionCount: 6,
            topTask: 'Algorithm Design',
        },
        criteria: {
            insightNonEmpty: true,
            reasonNonEmpty: true,
            // Good volume; expected priority is around consistency or scheduling
            priorityContainsOneOf: ['consistency', 'schedule', 'deep work', 'habit', 'focus', 'volume'],
            sourceIs: ['llm', 'fallback'],
        },
    },
    {
        id: 'eval-04',
        description: 'User with minimal data asks a narrow question about a specific task.',
        userRequest: 'Am I spending enough time on my top task?',
        mockAnalysis: {
            totalMinutes: 45,
            sessionCount: 3,
            topTask: 'Physics Lab Report',
        },
        criteria: {
            insightNonEmpty: true,
            reasonNonEmpty: true,
            // Should recommend more volume or focus since 45 min is still low
            priorityContainsOneOf: ['volume', 'focus', 'increase', 'more', 'start', 'consistency'],
            sourceIs: ['llm', 'fallback'],
        },
    },
];
