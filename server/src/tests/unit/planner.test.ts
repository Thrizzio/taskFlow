/**
 * Unit test: planner (createPlan)
 *
 * createPlan is a pure deterministic function — given a request string,
 * it returns a Plan object with goals and an optional timeframe.
 * No database connection or external API is needed.
 */

import { describe, it, expect } from 'vitest';
import { createPlan } from '../../agent/planner';

describe('createPlan', () => {
    it('always includes the four standard goals', () => {
        const plan = createPlan('how am I doing?');
        expect(plan.goals).toContain('calculate total focus time');
        expect(plan.goals).toContain('count sessions');
        expect(plan.goals).toContain('identify most focused task');
        expect(plan.goals).toContain('identify an area for improvement');
    });

    it('sets timeframe to "week" when the request mentions week', () => {
        const plan = createPlan('How did I do this week?');
        expect(plan.timeframe).toBe('week');
    });

    it('sets timeframe to "day" when the request mentions day', () => {
        const plan = createPlan('Summary for today');
        expect(plan.timeframe).toBe('day');
    });

    it('leaves timeframe undefined when no timeframe keyword is present', () => {
        const plan = createPlan('Give me a productivity overview');
        expect(plan.timeframe).toBeUndefined();
    });

    it('returns at least one goal for any request', () => {
        const plan = createPlan('');
        expect(plan.goals.length).toBeGreaterThan(0);
    });
});
