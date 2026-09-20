import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            login(data.token, data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
            <h2>Login to FocusFlow</h2>
            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ padding: '8px' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ padding: '8px' }}
                />
                <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
                    Login
                </button>
            </form>

            <div style={{ margin: '1.5rem 0', textAlign: 'center', position: 'relative' }}>
                <hr style={{ border: 'none', borderTop: '1px solid #ddd' }} />
                <span style={{ position: 'absolute', top: '-10px', background: 'white', padding: '0 8px', color: '#666', fontSize: '12px', left: '50%', transform: 'translateX(-50%)' }}>OR</span>
            </div>

            <button
                type="button"
                onClick={async () => {
                    try {
                        const res = await fetch('http://localhost:4000/api/auth/google/url');
                        const data = await res.json();
                        if (data.url) {
                            window.location.href = data.url;
                        }
                    } catch (err: any) {
                        setError('Failed to initiate Google sign-in');
                    }
                }}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: '#ffffff',
                    color: '#333',
                    border: '1px solid #ccc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 500,
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign in with Google
            </button>

            <p style={{ marginTop: '1rem' }}>
                Don't have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
};
