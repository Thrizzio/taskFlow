/**
 * LLM Evaluation Runner
 *
 * How it works:
 *   1. Loads the evaluation cases from evalCases.ts.
 *   2. For each case, calls getLlmInsight() with the case's mockAnalysis and
 *      userRequest.  The mock analysis avoids any database dependency so the
 *      runner is fully self-contained and deterministic (for the fallback path)
 *      or LLM-dependent (when GEMINI_API_KEY is set).
 *   3. Scores the returned LlmInsight against the defined criteria.
 *   4. Prints a human-readable pass/fail report to stdout.
 *
 * Run with:
 *   npx ts-node src/agent/eval/evalRunner.ts
 *
 * (from the server/ directory)
 */

import { evalCases, EvalCase, EvalCriteria } from './evalCases';
import { getLlmInsight, LlmInsight } from '../llmInsight';

// ── Scoring ───────────────────────────────────────────────────────────────────

interface EvalResult {
    caseId: string;
    description: string;
    pass: boolean;
    failures: string[];
    insight: LlmInsight;
}

/**
 * scoreResult
 *
 * Checks an LlmInsight against the criteria defined in the eval case.
 * Returns a list of failure messages (empty list = pass).
 */
function scoreResult(insight: LlmInsight, criteria: EvalCriteria): string[] {
    const failures: string[] = [];

    if (!insight.insight || insight.insight.trim() === '') {
        failures.push('insight field is empty');
    }

    if (!insight.reason || insight.reason.trim() === '') {
        failures.push('reason field is empty');
    }

    const priorityLower = (insight.priority ?? '').toLowerCase();
    const matchesPriority = criteria.priorityContainsOneOf.some(
        (keyword) => priorityLower.includes(keyword.toLowerCase()),
    );
    if (!matchesPriority) {
        failures.push(
            `priority "${insight.priority}" does not match any expected keyword: ` +
            `[${criteria.priorityContainsOneOf.join(', ')}]`,
        );
    }

    if (!criteria.sourceIs.includes(insight.source)) {
        failures.push(
            `source "${insight.source}" is not in expected [${criteria.sourceIs.join(', ')}]`,
        );
    }

    return failures;
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runEval(): Promise<void> {
    console.log('═'.repeat(60));
    console.log('  FocusFlow LLM Evaluation Runner');
    console.log('═'.repeat(60));
    console.log();

    const results: EvalResult[] = [];

    for (const evalCase of evalCases) {
        process.stdout.write(`Running [${evalCase.id}] ${evalCase.description} ... `);

        const insight = await getLlmInsight(evalCase.mockAnalysis, evalCase.userRequest);
        const failures = scoreResult(insight, evalCase.criteria);
        const pass = failures.length === 0;

        console.log(pass ? '✅ PASS' : '❌ FAIL');

        results.push({
            caseId: evalCase.id,
            description: evalCase.description,
            pass,
            failures,
            insight,
        });
    }

    // ── Detailed report ───────────────────────────────────────────────────────
    console.log();
    console.log('─'.repeat(60));
    console.log('  Detailed Results');
    console.log('─'.repeat(60));

    for (const r of results) {
        console.log();
        console.log(`[${r.caseId}] ${r.description}`);
        console.log(`  source   : ${r.insight.source}`);
        console.log(`  priority : ${r.insight.priority}`);
        console.log(`  insight  : ${r.insight.insight}`);
        console.log(`  reason   : ${r.insight.reason}`);
        console.log(`  tokens   : input=${r.insight.usage.inputTokens}, output=${r.insight.usage.outputTokens}, total=${r.insight.usage.totalTokens}`);
        console.log(`  cost     : $${r.insight.estimatedCostUsd.toFixed(8)} USD`);

        if (!r.pass) {
            for (const f of r.failures) {
                console.log(`  ⚠ FAIL: ${f}`);
            }
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const passed = results.filter((r) => r.pass).length;
    const total = results.length;

    console.log();
    console.log('─'.repeat(60));
    console.log(`  Result: ${passed}/${total} passed`);
    console.log('═'.repeat(60));

    if (passed < total) {
        process.exit(1);
    }
}

runEval().catch((err) => {
    console.error('Eval runner failed:', err);
    process.exit(1);
});
