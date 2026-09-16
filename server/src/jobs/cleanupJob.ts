import fs from 'fs';
import path from 'path';
import config from '../utils/config';
import { Task } from '../models/Task';

export interface CleanupJobResult {
    scanned: number;
    deleted: number;
    reclaimedBytes: number;
    preserved: number;
    error: string | null;
}

export interface CleanupJobOptions {
    uploadDir?: string;
    maxAgeHours?: number;
}

/**
 * Scheduled maintenance job that identifies and purges orphaned file attachments
 * from the uploads directory.
 *
 * An attachment is orphaned if:
 * 1. It exists physically on disk in the upload directory.
 * 2. It is NOT referenced in any Task's attachments array in MongoDB.
 * 3. Its age exceeds the grace period (default 24h) to prevent deleting files
 *    from active concurrent uploads in-flight.
 */
export async function runMaintenanceJob(options: CleanupJobOptions = {}): Promise<CleanupJobResult> {
    const uploadDir = options.uploadDir || config?.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');
    const maxAgeHours = options.maxAgeHours ?? config?.ORPHANED_FILE_MAX_AGE_HOURS ?? 24;
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    const result: CleanupJobResult = {
        scanned: 0,
        deleted: 0,
        reclaimedBytes: 0,
        preserved: 0,
        error: null,
    };

    try {
        // Ensure upload directory exists before attempting read
        if (!fs.existsSync(uploadDir)) {
            return result;
        }

        const files = await fs.promises.readdir(uploadDir);
        result.scanned = files.length;

        if (files.length === 0) {
            return result;
        }

        // Gather all referenced stored attachment names from MongoDB
        let referencedFilenames = new Set<string>();
        try {
            const tasksWithAttachments = await Task.find(
                { 'attachments.0': { $exists: true } },
                { 'attachments.storedName': 1 }
            ).lean();

            for (const task of tasksWithAttachments) {
                if (Array.isArray(task.attachments)) {
                    for (const att of task.attachments) {
                        if (att.storedName) {
                            referencedFilenames.add(att.storedName);
                        }
                    }
                }
            }
        } catch (dbErr: any) {
            console.warn('[CleanupJob] Could not query tasks for referenced attachments; skipping deletion to prevent data loss:', dbErr.message);
            result.error = dbErr.message;
            return result;
        }

        // Scan files and delete unreferenced files older than grace threshold
        for (const file of files) {
            const filePath = path.join(uploadDir, file);

            try {
                const stat = await fs.promises.stat(filePath);

                // Ignore subdirectories if any
                if (!stat.isFile()) {
                    continue;
                }

                if (referencedFilenames.has(file)) {
                    result.preserved++;
                    continue;
                }

                // File is not referenced in MongoDB
                const fileAge = now - stat.mtimeMs;
                if (fileAge >= maxAgeMs) {
                    await fs.promises.unlink(filePath);
                    result.deleted++;
                    result.reclaimedBytes += stat.size;
                } else {
                    // Within grace period (e.g. ongoing upload)
                    result.preserved++;
                }
            } catch (fileErr: any) {
                console.warn(`[CleanupJob] Error inspecting/deleting file "${file}":`, fileErr.message);
            }
        }

        if (process.env.NODE_ENV !== 'test') {
            console.log(
                `[CleanupJob] Finished: scanned ${result.scanned}, deleted ${result.deleted} orphaned files, reclaimed ${result.reclaimedBytes} bytes.`
            );
        }

        return result;
    } catch (err: any) {
        console.error('[CleanupJob] Unhandled maintenance error:', err);
        result.error = err.message || 'Unknown error in cleanup job';
        return result;
    }
}
