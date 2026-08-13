import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
            const res = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
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
            await fetch('http://localhost:4000/api/focus-sessions', {
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
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <header style={{ marginBottom: '2rem', textAlign: 'left' }}>
                <Link to={`/tasks/${taskId}`}>&larr; Back to Task</Link>
            </header>

            <h2>Focusing on: {task.title}</h2>

            <div style={{ fontSize: '4rem', margin: '2rem 0', fontFamily: 'monospace' }}>
                {formatTime(time)}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {(status === 'IDLE' || status === 'PAUSED') && (
                    <button onClick={startTimer} style={{ padding: '10px 20px', background: 'green', color: 'white' }}>
                        {status === 'IDLE' ? 'Start Focus' : 'Resume'}
                    </button>
                )}

                {status === 'RUNNING' && (
                    <button onClick={pauseTimer} style={{ padding: '10px 20px', background: 'orange' }}>
                        Pause
                    </button>
                )}

                {(status === 'RUNNING' || status === 'PAUSED') && (
                    <button onClick={completeSession} style={{ padding: '10px 20px', background: 'blue', color: 'white' }}>
                        Complete Session
                    </button>
                )}
            </div>
        </div>
    );
};
