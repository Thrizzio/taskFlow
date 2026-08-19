/**
 * Agent Tools — controlled function-calling for the productivity workflow
 *
 * This file defines the complete set of tools the LLM is allowed to request.
 * The server NEVER executes arbitrary functions. It:
 *   1. Validates the tool name against the TOOL_REGISTRY (whitelist).
 *   2. Validates the arguments against the tool's schema.
 *   3. Only then calls the corresponding server-side function.
 *
 * Tool calling flow (in llmInsight.ts):
 *   LLM request → function_declarations → Gemini may return functionCall
 *   → server validates name + args → server executes → result returned to LLM
 *   → LLM produces the final structured insight
 */

import { AnalysisResult } from './analyzer';

// ── Tool definitions ──────────────────────────────────────────────────────────
// These are sent to Gemini so it knows what tools exist and what args to pass.
// Format matches the Gemini REST API `tools[].functionDeclarations` schema.

export const TOOL_DECLARATIONS = [
    {
        name: 'getProductivitySummary',
        description:
            'Returns a structured productivity summary derived from the user\'s recorded focus sessions. ' +
            'Call this tool when you need numeric metrics such as total minutes, session count, and top task.',
        parameters: {
            type: 'object',
            properties: {
                includeTopTask: {
                    type: 'boolean',
                    description: 'If true, the summary includes the name of the task with the most focus time.',
                },
            },
            required: [],
        },
    },
] as const;

// ── Tool result type ──────────────────────────────────────────────────────────

export interface ToolResult {
    toolName: string;
    result: Record<string, unknown>;
}

// ── Server-side tool implementations ─────────────────────────────────────────
// These are the ONLY functions the tool dispatcher may call.

function getProductivitySummary(
    analysis: AnalysisResult,
    args: Record<string, unknown>,
): Record<string, unknown> {
    const summary: Record<string, unknown> = {
        totalMinutes: analysis.totalMinutes,
        sessionCount: analysis.sessionCount,
    };
    if (args.includeTopTask !== false && analysis.topTask) {
        summary.topTask = analysis.topTask;
    }
    return summary;
}

// ── Safe tool dispatcher ───────────────────────────────────────────────────────
// Maps tool names to their implementation.
// Any name NOT in this map is rejected before execution.

const TOOL_REGISTRY: Record<
    string,
    (analysis: AnalysisResult, args: Record<string, unknown>) => Record<string, unknown>
> = {
    getProductivitySummary,
};

/**
 * executeTool
 *
 * Validates and executes a tool requested by the LLM.
 * Returns null if the tool name is not in the registry (unknown/disallowed tool).
 */
export function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    analysis: AnalysisResult,
): ToolResult | null {
    const fn = TOOL_REGISTRY[toolName];
    if (!fn) {
        console.warn(`[agentTools] Rejected unknown tool request: "${toolName}"`);
        return null;
    }
    const result = fn(analysis, args);
    return { toolName, result };
}
