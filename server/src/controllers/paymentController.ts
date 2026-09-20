import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import config from '../utils/config';

export const PLANS: Record<string, { amount: number; currency: string; name: string }> = {
    pro_monthly: {
        amount: 49900, // ₹499.00 in paise
        currency: 'INR',
        name: 'Pro Monthly',
    },
    pro_annual: {
        amount: 499900, // ₹4,999.00 in paise
        currency: 'INR',
        name: 'Pro Annual',
    },
};

/**
 * Creates a payment order for the requested subscription plan.
 * Generates a unique orderId and stores an unverified Payment record.
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const planKey = req.body?.plan || 'pro_monthly';
        const selectedPlan = PLANS[planKey] || PLANS.pro_monthly;

        const orderId = `order_sbx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const receipt = `rcpt_${Date.now()}`;

        const payment = new Payment({
            userId: req.user.userId,
            orderId,
            amount: selectedPlan.amount,
            currency: selectedPlan.currency,
            status: 'created',
            plan: planKey,
            receipt,
        });

        await payment.save();

        res.status(201).json({
            orderId,
            amount: selectedPlan.amount,
            currency: selectedPlan.currency,
            plan: planKey,
            planName: selectedPlan.name,
            keyId: config.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('createOrder error:', error);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
};

/**
 * Server-Side Cryptographic Signature Verification
 *
 * CRITICAL SECURITY PRINCIPLE:
 * The server MUST NEVER trust a client claim like `paymentSuccessful: true`.
 * Verification requires computing HMAC-SHA256(order_id + "|" + payment_id, secret)
 * and performing a constant-time comparison against the provider's signature.
 */
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            res.status(400).json({
                success: false,
                error: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required',
            });
            return;
        }

        const payment = await Payment.findOne({
            orderId: razorpay_order_id,
            userId: req.user.userId,
        });

        if (!payment) {
            res.status(404).json({ success: false, error: 'Payment order not found for this user' });
            return;
        }

        // Cryptographic HMAC-SHA256 signature calculation
        const expectedSignature = crypto
            .createHmac('sha256', config.RAZORPAY_KEY_SECRET as string)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        // Timing-safe comparison to prevent side-channel timing attacks
        let isValid = false;
        if (typeof razorpay_signature === 'string' && razorpay_signature.length === expectedSignature.length) {
            isValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'utf8'),
                Buffer.from(razorpay_signature, 'utf8')
            );
        }

        // Support sandbox test simulation token only when using local mock test keys
        if (!isValid && config.RAZORPAY_KEY_SECRET === 'rzp_test_mock_secret' && razorpay_signature === 'sandbox_verified_signature') {
            isValid = true;
        }

        if (!isValid) {
            payment.status = 'failed';
            await payment.save();
            res.status(400).json({
                success: false,
                error: 'Invalid payment signature. Verification failed.',
            });
            return;
        }

        // Update payment status to paid
        payment.status = 'paid';
        payment.paymentId = razorpay_payment_id;
        payment.signature = razorpay_signature;
        await payment.save();

        // Upgrade user account to Pro tier
        await User.findByIdAndUpdate(req.user.userId, { isPro: true });

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully and Pro tier activated',
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
        });
    } catch (error) {
        console.error('verifyPayment error:', error);
        res.status(500).json({ success: false, error: 'Internal payment verification error' });
    }
};

/**
 * Returns user subscription status and payment history.
 */
export const getSubscriptionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await User.findById(req.user.userId);
        const payments = await Payment.find({ userId: req.user.userId }).sort({ createdAt: -1 });

        res.json({
            isPro: Boolean(user?.isPro),
            payments,
        });
    } catch (error) {
        console.error('getSubscriptionStatus error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
};
