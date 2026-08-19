import config from '../utils/config';
import { AnalysisResult } from './analyzer';
import { TOOL_DECLARATIONS, executeTool } from './agentTools';

// ── LLM Insight Stage ────────────────────────────────────────────────────────
//
// Stage 3 of the multi-step agent workflow.
//
// Receives the structured AnalysisResult from the Analyzer and the original
// user request, then calls the Gemini API with optional tool-calling support
// to produce a concise interpretation.
//
// Tool-calling flow (multi-turn):
//   1. First request — send prompt + TOOL_DECLARATIONS to Gemini
//   2. If Gemini responds with a `functionCall`, the server validates the tool
//      name against the registry in agentTools.ts, executes the function, and
//      sends the result back in a second request.
//   3. The second response contains the final text insight.
//
// If Gemini does not request a tool, the first response is used directly.
//
// The LLM cannot execute arbitrary functions: only tools listed in
// TOOL_DECLARATIONS and present in TOOL_REGISTRY (agentTools.ts) are allowed.
//
// Multi-step flow position:
//   Planner → Analyzer → [LLM Insight] → Recommender
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Token usage ───────────────────────────────────────────────────────────────
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

/** Structured insight returned by the LLM (or the fallback path). */
export interface LlmInsight {
    insight: string;
    priority: string;
    reason: string;
    source: 'llm' | 'fallback';
    usage: TokenUsage;
    estimatedCostUsd: number;
}

/** Gemini API endpoint (gemini-2.0-flash-lite is fast and cheap). */
const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

// ── Gemini response shape ─────────────────────────────────────────────────────

interface GeminiPart {
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
}

interface GeminiResponse {
    candidates?: Array<{
        content?: { parts?: GeminiPart[]; role?: string };
        finishReason?: string;
    }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * getLlmInsight
 *
 * Calls Gemini with tool-calling support and returns a structured insight.
 * Falls back to a deterministic result if the API is unavailable or fails.
 */
export async function getLlmInsight(
    analysis: AnalysisResult,
    userRequest: string,
): Promise<LlmInsight> {
    const apiKey = config.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[llmInsight] GEMINI_API_KEY not set — using fallback insight.');
        return buildFallback(analysis);
    }

    const systemInstruction =
        'You are a productivity analysis assistant. ' +
        'You may call the getProductivitySummary tool to retrieve structured metrics. ' +
        'After reviewing the metrics, return a JSON object with exactly three ' +
        'string fields: "insight", "priority", and "reason". ' +
        'Do not include markdown fences or extra text — only the JSON object.';

    const userMessage =
        `User request: "${userRequest}"\n` +
        `Raw metrics available: ${JSON.stringify(analysis)}`;

    // The tool declarations tell Gemini what tools exist and what args they accept.
    const tools = [{ functionDeclarations: TOOL_DECLARATIONS }];

    const firstRequestBody = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        tools,
        generationConfig: { temperature: 0.3 },
    };

    try {
        // ── Turn 1: Initial Gemini call ───────────────────────────────────────
        const firstResponse = await fetchGemini(firstRequestBody, apiKey);
        if (!firstResponse) return buildFallback(analysis);

        const firstParts = firstResponse.candidates?.[0]?.content?.parts ?? [];
        const functionCallPart = firstParts.find((p) => p.functionCall);

        let finalResponse = firstResponse;

        if (functionCallPart?.functionCall) {
            // ── Turn 2: Tool was requested — validate and execute ─────────────
            const { name, args } = functionCallPart.functionCall;

            // executeTool returns null for any tool NOT in the registry
            const toolResult = executeTool(name, args, analysis);

            if (toolResult) {
                console.log(`[llmInsight] Tool "${name}" executed by server.`);

                // Build the multi-turn conversation with the tool's result
                const secondRequestBody = {
                    system_instruction: { parts: [{ text: systemInstruction }] },
                    contents: [
                        { role: 'user', parts: [{ text: userMessage }] },
                        // Echo back what Gemini asked for
                        { role: 'model', parts: [{ functionCall: functionCallPart.functionCall }] },
                        // Provide the server-side tool result
                        {
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: toolResult.toolName,
                                    response: { result: toolResult.result },
                                },
                            }],
                        },
                    ],
                    tools,
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
                };

                const secondResponse = await fetchGemini(secondRequestBody, apiKey);
                if (secondResponse) finalResponse = secondResponse;
            } else {
                console.warn(`[llmInsight] Unknown tool "${name}" — skipping tool turn.`);
            }
        } else {
            // No tool call — Gemini should have returned JSON directly
            // (force JSON mime on first request if needed)
        }

        // ── Parse the final response ──────────────────────────────────────────
        const parts = finalResponse.candidates?.[0]?.content?.parts ?? [];
        const rawText = parts.find((p) => p.text)?.text ?? '';
        const parsed = parseInsightJson(rawText);
        if (!parsed) {
            console.error('[llmInsight] Could not parse LLM response as insight JSON.');
            return buildFallback(analysis);
        }

        const usage = extractUsage(finalResponse.usageMetadata);
        const estimatedCostUsd = calculateCost(usage);
        console.log(
            `[llmInsight] tokens — in:${usage.inputTokens} out:${usage.outputTokens} ` +
            `cost:$${estimatedCostUsd.toFixed(8)}`,
        );

        return { ...parsed, source: 'llm', usage, estimatedCostUsd };

    } catch (err) {
        console.error('[llmInsight] Gemini request failed:', err);
        return buildFallback(analysis);
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function fetchGemini(
    body: Record<string, unknown>,
    apiKey: string,
): Promise<GeminiResponse | null> {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        console.error(`[llmInsight] Gemini HTTP ${response.status}`);
        return null;
    }
    return response.json() as Promise<GeminiResponse>;
}

function extractUsage(usageMetadata?: GeminiResponse['usageMetadata']): TokenUsage {
    return {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
    };
}

function calculateCost(usage: TokenUsage): number {
    const { inputPer1kTokens, outputPer1kTokens } = config.GEMINI_PRICING;
    return (usage.inputTokens / 1000) * inputPer1kTokens
        + (usage.outputTokens / 1000) * outputPer1kTokens;
}

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

function parseInsightJson(raw: string): Omit<LlmInsight, 'source' | 'usage' | 'estimatedCostUsd'> | null {
    try {
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const insight = typeof obj.insight === 'string' ? obj.insight : null;
        const priority = typeof obj.priority === 'string' ? obj.priority : null;
        const reason = typeof obj.reason === 'string' ? obj.reason : null;
        if (!insight || !priority || !reason) return null;
        return { insight, priority, reason };
    } catch {
        return null;
    }
}

function buildFallback(analysis: AnalysisResult): LlmInsight {
    let insight: string;
    let priority: string;
    let reason: string;

    if (analysis.sessionCount === 0) {
        insight = 'No focus sessions recorded yet.';
        priority = 'start';
        reason = 'You need at least one session to build a momentum baseline.';
    } else if (analysis.totalMinutes < 60) {
        insight = `Only ${analysis.totalMinutes} minutes of focus logged — below a productive threshold.`;
        priority = 'volume';
        reason = 'Increasing total focus time is the highest-leverage improvement right now.';
    } else {
        insight = `${analysis.totalMinutes} minutes across ${analysis.sessionCount} sessions detected.`;
        priority = 'consistency';
        reason = 'Good overall volume — maintaining a regular schedule will compound the gains.';
    }

    return { insight, priority, reason, source: 'fallback', usage: ZERO_USAGE, estimatedCostUsd: 0 };
}
