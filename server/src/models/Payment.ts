import mongoose from 'mongoose';

export interface IPayment extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    orderId: string;
    paymentId?: string;
    amount: number;
    currency: string;
    status: 'created' | 'paid' | 'failed';
    plan: string;
    signature?: string;
    receipt?: string;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    paymentId: {
        type: String,
        sparse: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    status: {
        type: String,
        enum: ['created', 'paid', 'failed'],
        default: 'created',
        index: true,
    },
    plan: {
        type: String,
        default: 'pro_monthly',
    },
    signature: {
        type: String,
    },
    receipt: {
        type: String,
    },
}, { timestamps: true });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
