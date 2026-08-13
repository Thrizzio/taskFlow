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

export const FocusSession = mongoose.model('FocusSession', focusSessionSchema);
