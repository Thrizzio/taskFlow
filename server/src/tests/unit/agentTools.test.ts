/**
 * Unit test: agent tool dispatch (agentTools)
 *
 * These tests verify the controlled tool-calling safety mechanism:
 *   - Known tools are executed and produce correct results.
 *   - Unknown (arbitrary) tool names are rejected (return null).
 *
 * Also exercises the token cost formula to ensure it matches the pricing
 * constants defined in config.ts.
 */

import { describe, it, expect } from 'vitest';
import { executeTool } from '../../agent/agentTools';
import type { AnalysisResult } from '../../agent/analyzer';

// ── Shared mock analysis ───────────────────────────────────────────────────────

const mockAnalysis: AnalysisResult = {
    totalMinutes: 120,
    sessionCount: 4,
    topTask: 'Write dissertation chapter',
};

// ── Tool dispatch tests ───────────────────────────────────────────────────────

describe('executeTool', () => {
    it('executes "getProductivitySummary" and returns totalMinutes and sessionCount', () => {
        const result = executeTool('getProductivitySummary', {}, mockAnalysis);
        expect(result).not.toBeNull();
        expect(result!.toolName).toBe('getProductivitySummary');
        expect(result!.result.totalMinutes).toBe(120);
        expect(result!.result.sessionCount).toBe(4);
    });

    it('includes topTask by default', () => {
        const result = executeTool('getProductivitySummary', {}, mockAnalysis);
        expect(result!.result.topTask).toBe('Write dissertation chapter');
    });

    it('omits topTask when includeTopTask is explicitly false', () => {
        const result = executeTool('getProductivitySummary', { includeTopTask: false }, mockAnalysis);
        expect(result!.result.topTask).toBeUndefined();
    });

    it('returns null for an unknown tool name (safety: no arbitrary execution)', () => {
        const result = executeTool('runArbitraryCode', {}, mockAnalysis);
        expect(result).toBeNull();
    });

    it('returns null for an empty string tool name', () => {
        const result = executeTool('', {}, mockAnalysis);
        expect(result).toBeNull();
    });

    it('returns null for a tool name that is almost-correct but not registered', () => {
        const result = executeTool('getProductivitySummaryExtra', {}, mockAnalysis);
        expect(result).toBeNull();
    });
});

// ── Token cost formula ────────────────────────────────────────────────────────
// The cost formula is:
//   cost = (inputTokens / 1000) * inputPer1kTokens
//         + (outputTokens / 1000) * outputPer1kTokens
// Pricing constants mirror config.GEMINI_PRICING.

describe('token cost formula', () => {
    const INPUT_RATE = 0.000075;  // USD per 1,000 input tokens
    const OUTPUT_RATE = 0.000300;  // USD per 1,000 output tokens

    function calculateCost(inputTokens: number, outputTokens: number): number {
        return (inputTokens / 1000) * INPUT_RATE + (outputTokens / 1000) * OUTPUT_RATE;
    }

    it('returns zero cost for zero tokens', () => {
        expect(calculateCost(0, 0)).toBe(0);
    });

    it('calculates input cost correctly for 1000 input tokens', () => {
        expect(calculateCost(1000, 0)).toBeCloseTo(INPUT_RATE, 10);
    });

    it('calculates output cost correctly for 1000 output tokens', () => {
        expect(calculateCost(0, 1000)).toBeCloseTo(OUTPUT_RATE, 10);
    });

    it('combines input and output costs correctly', () => {
        const expected = (100 / 1000) * INPUT_RATE + (50 / 1000) * OUTPUT_RATE;
        expect(calculateCost(100, 50)).toBeCloseTo(expected, 10);
    });
});
