import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../models/Task', () => ({
    Task: {
        find: vi.fn(),
    },
}));

vi.mock('../../utils/config', () => ({
    default: {
        UPLOAD_DIR: '',
        CLEANUP_CRON_SCHEDULE: '0 * * * *',
        ORPHANED_FILE_MAX_AGE_HOURS: 24,
    },
    validateEnv: vi.fn(),
}));

import { Task } from '../../models/Task';
import { runMaintenanceJob } from '../../jobs/cleanupJob';
import { startScheduler, stopScheduler } from '../../jobs/scheduler';

describe('Scheduled Maintenance Job: runMaintenanceJob', () => {
    let tempDir: string;

    beforeEach(() => {
        vi.clearAllMocks();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-cleanup-test-'));
    });

    afterEach(() => {
        stopScheduler();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('returns empty result when upload directory does not exist', async () => {
        const nonExistentDir = path.join(tempDir, 'does-not-exist');
        const result = await runMaintenanceJob({ uploadDir: nonExistentDir });

        expect(result.scanned).toBe(0);
        expect(result.deleted).toBe(0);
        expect(result.preserved).toBe(0);
        expect(result.error).toBeNull();
    });

    it('preserves referenced files and files within grace period, deleting only stale orphaned files', async () => {
        const activeFile = 'referenced-attachment.pdf';
        const staleOrphanFile = 'stale-orphan.txt';
        const recentOrphanFile = 'recent-orphan.jpg';

        const activePath = path.join(tempDir, activeFile);
        const stalePath = path.join(tempDir, staleOrphanFile);
        const recentPath = path.join(tempDir, recentOrphanFile);

        fs.writeFileSync(activePath, 'active content');
        fs.writeFileSync(stalePath, 'stale content to be purged');
        fs.writeFileSync(recentPath, 'recent upload in progress');

        // Set mtime for stale file to 48 hours ago
        const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
        fs.utimesSync(stalePath, twoDaysAgo, twoDaysAgo);

        // Mock Task.find returning the referenced attachment
        (Task.find as any).mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                {
                    attachments: [
                        { storedName: activeFile, originalName: 'report.pdf' },
                    ],
                },
            ]),
        });

        const result = await runMaintenanceJob({ uploadDir: tempDir, maxAgeHours: 24 });

        expect(result.scanned).toBe(3);
        expect(result.deleted).toBe(1);
        expect(result.preserved).toBe(2);
        expect(result.reclaimedBytes).toBeGreaterThan(0);

        // Active file must still exist
        expect(fs.existsSync(activePath)).toBe(true);
        // Recent orphan within grace period must still exist
        expect(fs.existsSync(recentPath)).toBe(true);
        // Stale orphan must be unlinked
        expect(fs.existsSync(stalePath)).toBe(false);
    });

    it('safely skips deletions if database lookup fails (fail-safe against data loss)', async () => {
        const orphanFile = 'orphaned.txt';
        const filePath = path.join(tempDir, orphanFile);
        fs.writeFileSync(filePath, 'stale orphan');

        const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
        fs.utimesSync(filePath, twoDaysAgo, twoDaysAgo);

        (Task.find as any).mockReturnValue({
            lean: vi.fn().mockRejectedValue(new Error('MongoDB connection failure')),
        });

        const result = await runMaintenanceJob({ uploadDir: tempDir, maxAgeHours: 24 });

        // Must not delete file when DB check fails
        expect(result.deleted).toBe(0);
        expect(result.error).toContain('MongoDB connection failure');
        expect(fs.existsSync(filePath)).toBe(true);
    });
});

describe('Scheduled Task Lifecycle: scheduler.ts', () => {
    afterEach(() => {
        stopScheduler();
    });

    it('starts and stops scheduler without throwing errors', () => {
        const task = startScheduler();
        expect(task).not.toBeNull();

        stopScheduler();
    });
});
