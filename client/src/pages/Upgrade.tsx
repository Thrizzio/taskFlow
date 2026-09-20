import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

export const Upgrade = () => {
    const { token, user } = useAuth();
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [orderData, setOrderData] = useState<{ orderId: string; amount: number; currency: string } | null>(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/payment/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsPro(data.isPro);
                }
            } catch (err) {
                console.error('Failed to fetch subscription status:', err);
            }
        };
        if (token) fetchStatus();
    }, [token]);

    const handleCreateOrder = async () => {
        setLoading(true);
        setStatusMessage(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ plan: 'pro_monthly' })
            });

            if (res.ok) {
                const data = await res.json();
                setOrderData(data);
                setStatusMessage({
                    type: 'success',
                    text: `Order created: ${data.orderId} (₹${data.amount / 100}). Ready for sandbox verification.`
                });
            } else {
                setStatusMessage({ type: 'error', text: 'Failed to create payment order.' });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Error creating order.' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySandboxPayment = async (tamperSignature = false) => {
        if (!orderData) return;
        setLoading(true);
        setStatusMessage(null);

        try {
            const paymentId = `pay_sbx_${Date.now()}`;
            // To simulate sandbox Razorpay HMAC SHA256 in test mode:
            // When not tampering, we send the payment details
            const signaturePayload = tamperSignature
                ? 'tampered_invalid_signature_hash'
                : 'sandbox_verified_signature';

            const res = await fetch(`${API_BASE_URL}/api/payment/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    razorpay_order_id: orderData.orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signaturePayload,
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setIsPro(true);
                setOrderData(null);
                setStatusMessage({
                    type: 'success',
                    text: 'Payment verified successfully! Pro tier activated.'
                });
            } else {
                setStatusMessage({
                    type: 'error',
                    text: data.error || 'Payment verification failed (cryptographic signature mismatch).'
                });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Payment verification failed.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Upgrade to FocusFlow Pro</h1>
                    <p style={{ color: '#666', margin: '4px 0 0 0' }}>Unlock full productivity superpowers</p>
                </div>
                <Link to="/dashboard" style={{ textDecoration: 'none', color: '#0070f3' }}>&larr; Back to Dashboard</Link>
            </header>

            {statusMessage && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '1.5rem',
                    background: statusMessage.type === 'success' ? '#e6f4ea' : '#fce8e6',
                    color: statusMessage.type === 'success' ? '#137333' : '#c5221f',
                    border: `1px solid ${statusMessage.type === 'success' ? '#ceead6' : '#fad2cf'}`
                }}>
                    {statusMessage.text}
                </div>
            )}

            {isPro && (
                <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#15803d' }}>⭐ Pro Subscription Active</h3>
                    <p style={{ margin: 0, color: '#166534' }}>
                        Account {user?.name} is active on FocusFlow Pro. All features unlocked.
                    </p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', background: '#fff' }}>
                    <h3 style={{ margin: '0 0 8px 0' }}>Free Plan</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0' }}>₹0 <span style={{ fontSize: '1rem', fontWeight: 400, color: '#64748b' }}>/ month</span></div>
                    <ul style={{ paddingLeft: '20px', color: '#475569', lineHeight: 1.8 }}>
                        <li>Basic task management</li>
                        <li>Local focus timer</li>
                        <li>Standard analytics</li>
                    </ul>
                </div>

                <div style={{ border: '2px solid #0070f3', borderRadius: '8px', padding: '1.5rem', background: '#f8fafc', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-12px', right: '16px', background: '#0070f3', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        RECOMMENDED
                    </div>
                    <h3 style={{ margin: '0 0 8px 0' }}>Pro Monthly</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '12px 0' }}>₹499 <span style={{ fontSize: '1rem', fontWeight: 400, color: '#64748b' }}>/ month</span></div>
                    <ul style={{ paddingLeft: '20px', color: '#1e293b', lineHeight: 1.8 }}>
                        <li><strong>Unlimited File Attachments</strong> (PDF, Images, Markdown)</li>
                        <li><strong>Real-Time WebSocket Synchronization</strong> across tabs</li>
                        <li><strong>PostgreSQL Analytics & Aggregation Pipelines</strong></li>
                        <li><strong>Cryptographically Verified Sandbox Billing</strong></li>
                    </ul>

                    {!isPro && (
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {!orderData ? (
                                <button
                                    onClick={handleCreateOrder}
                                    disabled={loading}
                                    style={{
                                        padding: '12px 20px',
                                        background: '#0070f3',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        cursor: loading ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {loading ? 'Creating Order...' : 'Upgrade Now (Sandbox)'}
                                </button>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
                                        Order ID: <code>{orderData.orderId}</code>
                                    </div>
                                    <button
                                        onClick={() => handleVerifySandboxPayment(false)}
                                        disabled={loading}
                                        style={{
                                            padding: '10px 16px',
                                            background: '#16a34a',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Simulate Valid Sandbox Payment
                                    </button>
                                    <button
                                        onClick={() => handleVerifySandboxPayment(true)}
                                        disabled={loading}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#dc2626',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Simulate Tampered Signature (Rejected)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
