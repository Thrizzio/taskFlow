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

/** Structured insight returned by the LLM (or the fallback path). */
export interface LlmInsight {
    insight: string;    // One-sentence interpretation of the user's productivity
    priority: string;   // Focus area the LLM recommends (e.g. "consistency")
    reason: string;     // Brief justification for the priority
    source: 'llm' | 'fallback'; // Distinguishes live LLM from graceful fallback
}

/** Gemini API endpoint (gemini-2.0-flash-lite is fast and cheap). */
const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

/**
 * getLlmInsight
 *
 * Outer responsibility: build the prompt, call Gemini, parse the response.
 * If anything goes wrong (missing key, network error, bad JSON) it returns a
 * controlled deterministic fallback so the agent workflow never crashes.
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
        // ── Call Gemini via native fetch ─────────────────────────────────────────
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

        // ── Parse the JSON the LLM produced ────────────────────────────────────
        const parsed = parseInsightJson(rawText);
        if (!parsed) {
            console.error('[llmInsight] Could not parse LLM response as insight JSON.');
            return buildFallback(analysis);
        }

        return { ...parsed, source: 'llm' };

    } catch (err) {
        // ── Network or unexpected error → fallback ───────────────────────────────
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
}

/**
 * Try to parse a raw LLM text as an LlmInsight-shaped JSON object.
 * Returns null if the required fields are missing or the text is not valid JSON.
 */
function parseInsightJson(raw: string): Omit<LlmInsight, 'source'> | null {
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
 * LLM is unavailable or fails. Keeps the 4-stage workflow intact.
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

    return { insight, priority, reason, source: 'fallback' };
}
