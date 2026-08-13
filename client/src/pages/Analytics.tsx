import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AnalyticsRow {
    userName: string;
    taskTitle: string;
    totalSeconds: string;
}

export const Analytics = () => {
    const [data, setData] = useState<AnalyticsRow[]>([]);
    const { token, user } = useAuth();
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/analytics/time-by-task', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    setData(await res.json());
                } else {
                    setError('Failed to load analytics.');
                }
            } catch (err) {
                setError('Failed to fetch from server.');
            }
        };
        fetchAnalytics();
    }, [token]);

    const formatTime = (secondsStr: string) => {
        const seconds = parseInt(secondsStr, 10);
        if (isNaN(seconds)) return '0m';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>Productivity Analytics (Powered by PostgreSQL JOIN)</h2>
                <Link to="/dashboard">Back to Dashboard</Link>
            </header>

            {error ? (
                <p style={{ color: 'red' }}>{error}</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                            <th style={{ padding: '12px', border: '1px solid #ddd' }}>User</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd' }}>Task</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd' }}>Time Spent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 && <tr><td colSpan={3} style={{ padding: '12px', textAlign: 'center' }}>No analytical data found yet. Build some focus sessions!</td></tr>}
                        {data.map((row, idx) => (
                            <tr key={idx} style={{ background: row.userName === user?.name ? '#e6f7ff' : 'transparent' }}>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.userName} {row.userName === user?.name ? '(You)' : ''}</td>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{row.taskTitle}</td>
                                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatTime(row.totalSeconds)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
