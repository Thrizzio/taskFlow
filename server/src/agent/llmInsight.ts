import config from '../utils/config';
import { AnalysisResult } from './analyzer';

// ── LLM Insight Stage ────────────────────────────────────────────────────────
//
// Stage 3 of the multi-step agent workflow.
//
// Receives the structured AnalysisResult from the Analyzer and the original
// user request, then calls the Gemini API to produce a concise interpretation.
//
// The output is consumed by the Recommender (stage 4) to augment the final
// recommendation with the LLM's reasoning.
//
// Multi-step flow position:
//   Planner → Analyzer → [LLM Insight] → Recommender
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Token usage ───────────────────────────────────────────────────────────────
// Populated from `usageMetadata` in the Gemini REST response.
// Fields map directly to the API's `promptTokenCount`, `candidatesTokenCount`,
// and `totalTokenCount` fields.  All values are 0 on the fallback path because
// no API call was made.
export interface TokenUsage {
    inputTokens: number;    // promptTokenCount from Gemini usageMetadata
    outputTokens: number;   // candidatesTokenCount from Gemini usageMetadata
    totalTokens: number;    // totalTokenCount from Gemini usageMetadata
}

/** Structured insight returned by the LLM (or the fallback path). */
export interface LlmInsight {
    insight: string;        // One-sentence interpretation of the user's productivity
    priority: string;       // Focus area the LLM recommends (e.g. "consistency")
    reason: string;         // Brief justification for the priority
    source: 'llm' | 'fallback'; // Distinguishes live LLM from graceful fallback
    // ── Monitoring fields ────────────────────────────────────────────────────
    usage: TokenUsage;      // Token counts extracted from Gemini usageMetadata
    estimatedCostUsd: number; // Calculated from config.GEMINI_PRICING (see config.ts)
}

/** Gemini API endpoint (gemini-2.0-flash-lite is fast and cheap). */
const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

/**
 * getLlmInsight
 *
 * Outer responsibility: build the prompt, call Gemini, parse the response,
 * and extract token usage for cost monitoring.
 *
 * If anything goes wrong (missing key, network error, bad JSON) it returns a
 * controlled deterministic fallback so the agent workflow never crashes.
 * On the fallback path, usage is all-zeros and estimatedCostUsd is 0 because
 * no API call was successfully completed.
 */
export async function getLlmInsight(
    analysis: AnalysisResult,
    userRequest: string,
): Promise<LlmInsight> {
    const apiKey = config.GEMINI_API_KEY;

    // ── Missing API key → return fallback immediately ─────────────────────────
    if (!apiKey) {
        console.warn('[llmInsight] GEMINI_API_KEY not set — using fallback insight.');
        return buildFallback(analysis);
    }

    // ── Build the prompt ──────────────────────────────────────────────────────
    const systemInstruction =
        'You are a productivity analysis assistant. ' +
        'Analyze the supplied metrics and return a JSON object with exactly three ' +
        'string fields: "insight", "priority", and "reason". ' +
        'Do not include any markdown fences or extra text — only the JSON object.';

    const userMessage =
        `User request: "${userRequest}"\n` +
        `Metrics: ${JSON.stringify(analysis)}`;

    const requestBody = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    };

    try {
        // ── Call Gemini via native fetch ──────────────────────────────────────
        const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            console.error(`[llmInsight] Gemini API returned HTTP ${response.status}`);
            return buildFallback(analysis);
        }

        const geminiResponse = await response.json() as GeminiResponse;
        const rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        // ── Parse the JSON the LLM produced ──────────────────────────────────
        const parsed = parseInsightJson(rawText);
        if (!parsed) {
            console.error('[llmInsight] Could not parse LLM response as insight JSON.');
            return buildFallback(analysis);
        }

        // ── Extract token usage from usageMetadata ────────────────────────────
        // Gemini REST responses include a `usageMetadata` object with
        // `promptTokenCount`, `candidatesTokenCount`, and `totalTokenCount`.
        // We read these directly rather than estimating from character count.
        const usage = extractUsage(geminiResponse.usageMetadata);
        const estimatedCostUsd = calculateCost(usage);

        console.log(
            `[llmInsight] tokens — input: ${usage.inputTokens}, ` +
            `output: ${usage.outputTokens}, total: ${usage.totalTokens}, ` +
            `estimatedCost: $${estimatedCostUsd.toFixed(8)}`
        );

        return { ...parsed, source: 'llm', usage, estimatedCostUsd };

    } catch (err) {
        // ── Network or unexpected error → fallback ────────────────────────────
        console.error('[llmInsight] Gemini request failed:', err);
        return buildFallback(analysis);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shape of the Gemini REST response we care about. */
interface GeminiResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
    // ── Token usage from Gemini usageMetadata ─────────────────────────────────
    // Present on every successful non-streaming generateContent response.
    usageMetadata?: {
        promptTokenCount?: number;      // input tokens
        candidatesTokenCount?: number;  // output tokens
        totalTokenCount?: number;       // sum of the above
    };
}

/**
 * extractUsage
 *
 * Maps Gemini's `usageMetadata` fields to the `TokenUsage` interface.
 * Falls back to 0 for any field that the API did not include.
 */
function extractUsage(usageMetadata?: GeminiResponse['usageMetadata']): TokenUsage {
    return {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
    };
}

/**
 * calculateCost
 *
 * Computes the estimated cost in USD using the pricing rates defined in
 * config.GEMINI_PRICING.  That object is the single place to update rates.
 *
 * Formula: (tokens / 1000) × ratePerThousand
 */
function calculateCost(usage: TokenUsage): number {
    const { inputPer1kTokens, outputPer1kTokens } = config.GEMINI_PRICING;
    const inputCost = (usage.inputTokens / 1000) * inputPer1kTokens;
    const outputCost = (usage.outputTokens / 1000) * outputPer1kTokens;
    return inputCost + outputCost;
}

/** Zero-usage / zero-cost value used on the fallback path. */
const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

/**
 * Try to parse a raw LLM text as an LlmInsight-shaped JSON object.
 * Returns null if the required fields are missing or the text is not valid JSON.
 */
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

/**
 * buildFallback
 *
 * Returns a deterministic insight derived from the AnalysisResult when the
 * LLM is unavailable or fails.  Keeps the 4-stage workflow intact.
 *
 * Usage is all-zeros because no Gemini API call was made.
 * estimatedCostUsd is 0 for the same reason.
 */
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
