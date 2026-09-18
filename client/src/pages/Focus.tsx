import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

export const Focus = () => {
    const [time, setTime] = useState(0);
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED'>('IDLE');
    const [task, setTask] = useState<any>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { token } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const taskId = queryParams.get('taskId');

    useEffect(() => {
        if (!taskId) return;
        const fetchTask = async () => {
            const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setTask(await res.json());
            }
        };
        fetchTask();
    }, [taskId, token]);

    const startTimer = () => {
        if (status === 'RUNNING') return;
        setStatus('RUNNING');
        timerRef.current = setInterval(() => {
            setTime(prev => prev + 1);
        }, 1000);
    };

    const pauseTimer = () => {
        if (status !== 'RUNNING') return;
        setStatus('PAUSED');
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const completeSession = async () => {
        setStatus('COMPLETED');
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            await fetch(`${API_BASE_URL}/api/focus-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    taskId,
                    duration: time,
                    startedAt: new Date(Date.now() - time * 1000).toISOString(),
                    endedAt: new Date().toISOString()
                })
            });
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!taskId || !task) return <div>Invalid or loading task...</div>;

    return (
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', textAlign: 'left' }}>
                <Link to={`/tasks/${taskId}`}>&larr; Back to Task</Link>
            </header>

            <h2 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', wordBreak: 'break-word' }}>Focusing on: {task.title}</h2>

            <div style={{ fontSize: 'clamp(2.8rem, 12vw, 4.5rem)', margin: '2rem 0', fontFamily: 'monospace', fontWeight: 700 }}>
                {formatTime(time)}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {(status === 'IDLE' || status === 'PAUSED') && (
                    <button onClick={startTimer} style={{ padding: '12px 24px', background: 'green', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', minWidth: '130px' }}>
                        {status === 'IDLE' ? 'Start Focus' : 'Resume'}
                    </button>
                )}

                {status === 'RUNNING' && (
                    <button onClick={pauseTimer} style={{ padding: '12px 24px', background: 'orange', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', minWidth: '130px' }}>
                        Pause
                    </button>
                )}

                {(status === 'RUNNING' || status === 'PAUSED') && (
                    <button onClick={completeSession} style={{ padding: '12px 24px', background: 'blue', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', minWidth: '130px' }}>
                        Complete Session
                    </button>
                )}
            </div>
        </div>
    );
};
