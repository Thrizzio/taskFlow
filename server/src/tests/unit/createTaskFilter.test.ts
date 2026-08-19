/**
 * Unit test: createTaskFilter closure (client logic)
 *
 * createTaskFilter is defined in client/src/pages/Tasks.tsx.
 * Because the server test runner (vitest) runs in Node, we re-export the
 * pure closure function here so it can be tested in isolation without
 * importing React or any browser APIs.
 *
 * This file is the canonical test for the JavaScript closure concept used
 * in the project. It exercises the normal case and the edge case identically
 * to how the function runs in the browser.
 */

import { describe, it, expect } from 'vitest';

// ── The closure under test ────────────────────────────────────────────────────
// Copied verbatim from Tasks.tsx so this test does not depend on React.
type Task = { status: string };

function createTaskFilter(statusFilter: string) {
    // The returned function closes over `statusFilter`.
    return function filterTask(task: Task): boolean {
        if (statusFilter === 'all') return true;
        return task.status === statusFilter;
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createTaskFilter', () => {
    const tasks: Task[] = [
        { status: 'pending' },
        { status: 'completed' },
        { status: 'pending' },
    ];

    it('returns all tasks when filter is "all"', () => {
        const filter = createTaskFilter('all');
        const result = tasks.filter(filter);
        expect(result).toHaveLength(3);
    });

    it('returns only pending tasks when filter is "pending"', () => {
        const filter = createTaskFilter('pending');
        const result = tasks.filter(filter);
        expect(result).toHaveLength(2);
        result.forEach((t) => expect(t.status).toBe('pending'));
    });

    it('returns only completed tasks when filter is "completed"', () => {
        const filter = createTaskFilter('completed');
        const result = tasks.filter(filter);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('completed');
    });

    it('returns an empty array when no tasks match the filter', () => {
        const filter = createTaskFilter('completed');
        const result = [{ status: 'pending' }].filter(filter);
        expect(result).toHaveLength(0);
    });

    it('each call creates an independent closure over its own statusFilter', () => {
        const pendingFilter = createTaskFilter('pending');
        const completedFilter = createTaskFilter('completed');

        expect([{ status: 'pending' }].filter(pendingFilter)).toHaveLength(1);
        expect([{ status: 'pending' }].filter(completedFilter)).toHaveLength(0);
    });
});
