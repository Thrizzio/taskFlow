import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    duration: {
        type: Number,
        required: true,
        min: 0
    },
    startedAt: {
        type: Date,
        required: true
    },
    endedAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'abandoned'],
        default: 'completed'
    }
}, { timestamps: true });

// ── MongoDB query indexes ─────────────────────────────────────────────────────
// `userId`            — productivityAgent queries sessions by userId (up to 200 docs)
// `[userId, taskId]`  — analyzeProductivity groups by taskId within a userId scope
// Task.userId already has { index: true } defined in its own schema.
focusSessionSchema.index({ userId: 1 });
focusSessionSchema.index({ userId: 1, taskId: 1 });

export const FocusSession = mongoose.model('FocusSession', focusSessionSchema);
