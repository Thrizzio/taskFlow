import cron, { ScheduledTask } from 'node-cron';
import config from '../utils/config';
import { runMaintenanceJob } from './cleanupJob';

let cleanupTask: ScheduledTask | null = null;

/**
 * Initializes recurring background cron schedules.
 * Defaults to running hourly (`0 * * * *`) or as configured by CLEANUP_CRON_SCHEDULE.
 */
export function startScheduler(): ScheduledTask | null {
    const scheduleExpression = config.CLEANUP_CRON_SCHEDULE || '0 * * * *';

    if (!cron.validate(scheduleExpression)) {
        console.error(`[Scheduler] Invalid cron expression: "${scheduleExpression}". Scheduler not started.`);
        return null;
    }

    try {
        cleanupTask = cron.schedule(scheduleExpression, async () => {
            console.log(`[Scheduler] Triggering scheduled cleanup job at ${new Date().toISOString()}...`);
            try {
                const stats = await runMaintenanceJob();
                console.log(`[Scheduler] Cleanup job finished: deleted ${stats.deleted} files.`);
            } catch (jobErr) {
                console.error('[Scheduler] Error executing scheduled cleanup job:', jobErr);
            }
        });

        console.log(`[Scheduler] Cleanup job scheduled with expression: "${scheduleExpression}"`);
        return cleanupTask;
    } catch (err) {
        console.error('[Scheduler] Failed to initialize cron scheduler:', err);
        return null;
    }
}

/**
 * Gracefully stops any active scheduled jobs (e.g. during server shutdown).
 */
export function stopScheduler(): void {
    if (cleanupTask) {
        cleanupTask.stop();
        cleanupTask = null;
        console.log('[Scheduler] Background jobs stopped.');
    }
}

export function getScheduledTask(): ScheduledTask | null {
    return cleanupTask;
}
