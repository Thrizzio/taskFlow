/**
 * Integration tests: Payment Gateway Integration (/api/payment)
 *
 * Demonstrates:
 * 1. Sandbox order creation (POST /api/payment/create-order)
 * 2. Cryptographic signature verification using HMAC-SHA256 (POST /api/payment/verify)
 * 3. Strict security: server never trusts client booleans; rejects tampered signatures with 400
 * 4. User subscription status & payment history (GET /api/payment/status)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const TEST_SECRET = 'test-secret-for-integration-tests';
const TEST_RAZORPAY_SECRET = 'rzp_test_mock_secret';

// Mock Payment and User models
vi.mock('../../models/Payment', () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const MockPaymentModel = vi.fn().mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
    });

    (MockPaymentModel as any).findOne = vi.fn();
    (MockPaymentModel as any).find = vi.fn();

    return { Payment: MockPaymentModel };
});

vi.mock('../../models/User', () => ({
    User: {
        findById: vi.fn(),
        findByIdAndUpdate: vi.fn(),
        findOne: vi.fn(),
    },
}));

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-integration-tests',
        GEMINI_API_KEY: undefined,
        GEMINI_PRICING: { inputPer1kTokens: 0.000075, outputPer1kTokens: 0.000300 },
        MONGODB_URI: 'mongodb://localhost/test',
        POSTGRES_DATABASE_URL: 'postgres://localhost/test',
        PORT: 4001,
        RAZORPAY_KEY_ID: 'rzp_test_mock_key',
        RAZORPAY_KEY_SECRET: 'rzp_test_mock_secret',
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';
import { Payment } from '../../models/Payment';
import { User } from '../../models/User';

const app = createApp();

function makeJwt(userId = '65f1a2b3c4d5e6f7a8b9c0d1', name = 'Test Buyer') {
    return jwt.sign(
        { userId, name },
        TEST_SECRET,
        { expiresIn: '5m' }
    );
}

describe('Payment Gateway Integration: Sandbox & Verification', () => {
    const userId = '65f1a2b3c4d5e6f7a8b9c0d1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/payment/create-order', () => {
        it('rejects unauthenticated requests with 401', async () => {
            const res = await request(app).post('/api/payment/create-order');
            expect(res.status).toBe(401);
        });

        it('creates an order for pro_monthly plan and returns 201 with order metadata', async () => {
            const res = await request(app)
                .post('/api/payment/create-order')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({ plan: 'pro_monthly' });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('orderId');
            expect(res.body.orderId).toMatch(/^order_sbx_/);
            expect(res.body.amount).toBe(49900); // ₹499.00
            expect(res.body.currency).toBe('INR');
            expect(res.body.plan).toBe('pro_monthly');
            expect(res.body.keyId).toBe('rzp_test_mock_key');
        });

        it('creates an order for pro_annual plan with correct discounted amount', async () => {
            const res = await request(app)
                .post('/api/payment/create-order')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({ plan: 'pro_annual' });

            expect(res.status).toBe(201);
            expect(res.body.amount).toBe(499900); // ₹4,999.00
            expect(res.body.plan).toBe('pro_annual');
        });
    });

    describe('POST /api/payment/verify', () => {
        it('rejects missing verification parameters with 400', async () => {
            const res = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({
                    razorpay_order_id: 'order_123',
                    // missing razorpay_payment_id and signature
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Missing required parameters');
        });

        it('returns 404 when payment order is not found for the user', async () => {
            vi.mocked(Payment.findOne).mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({
                    razorpay_order_id: 'order_nonexistent',
                    razorpay_payment_id: 'pay_123',
                    razorpay_signature: 'dummy_sig',
                });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Payment order not found');
        });

        it('rejects tampered or invalid cryptographic signatures with 400', async () => {
            const mockPayment: any = {
                orderId: 'order_sbx_test_123',
                userId,
                status: 'created',
                save: vi.fn().mockResolvedValue(true),
            };
            vi.mocked(Payment.findOne).mockResolvedValueOnce(mockPayment);

            const res = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({
                    razorpay_order_id: 'order_sbx_test_123',
                    razorpay_payment_id: 'pay_sbx_test_456',
                    razorpay_signature: 'fraudulent_or_tampered_signature_payload',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid payment signature');

            // Verify payment status was marked as failed
            expect(mockPayment.status).toBe('failed');
            expect(mockPayment.save).toHaveBeenCalled();
            // Verify user was NOT upgraded to Pro
            expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        });

        it('successfully verifies genuine HMAC-SHA256 signature and upgrades user to Pro', async () => {
            const orderId = 'order_sbx_valid_123';
            const paymentId = 'pay_sbx_valid_456';

            // Generate genuine HMAC-SHA256 signature matching server secret
            const validSignature = crypto
                .createHmac('sha256', TEST_RAZORPAY_SECRET)
                .update(`${orderId}|${paymentId}`)
                .digest('hex');

            const mockPayment: any = {
                orderId,
                userId,
                status: 'created',
                save: vi.fn().mockResolvedValue(true),
            };
            vi.mocked(Payment.findOne).mockResolvedValueOnce(mockPayment);
            vi.mocked(User.findByIdAndUpdate).mockResolvedValueOnce({ _id: userId, isPro: true } as any);

            const res = await request(app)
                .post('/api/payment/verify')
                .set('Authorization', `Bearer ${makeJwt(userId)}`)
                .send({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSignature,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Payment verified successfully');

            // Verify payment record was updated
            expect(mockPayment.status).toBe('paid');
            expect(mockPayment.paymentId).toBe(paymentId);
            expect(mockPayment.signature).toBe(validSignature);
            expect(mockPayment.save).toHaveBeenCalled();

            // Verify user is upgraded to Pro
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, { isPro: true });
        });
    });

    describe('GET /api/payment/status', () => {
        it('returns user subscription status and payment history', async () => {
            vi.mocked(User.findById).mockResolvedValueOnce({
                _id: userId,
                name: 'Alice Pro',
                isPro: true,
            } as any);

            const mockPayments = [
                {
                    orderId: 'order_sbx_1',
                    amount: 49900,
                    status: 'paid',
                    createdAt: new Date(),
                },
            ];
            const mockQuery = {
                sort: vi.fn().mockResolvedValueOnce(mockPayments),
            };
            vi.mocked(Payment.find).mockReturnValueOnce(mockQuery as any);

            const res = await request(app)
                .get('/api/payment/status')
                .set('Authorization', `Bearer ${makeJwt(userId)}`);

            expect(res.status).toBe(200);
            expect(res.body.isPro).toBe(true);
            expect(res.body.payments).toHaveLength(1);
            expect(res.body.payments[0].orderId).toBe('order_sbx_1');
        });
    });
});
