import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const TaskDetail = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const [task, setTask] = useState<any>(null);
    const { token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setTask(data);
                } else {
                    // Fallback or navigate away
                    navigate('/tasks');
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchTask();
    }, [taskId, token, navigate]);

    const toggleStatus = async () => {
        try {
            const newStatus = task.status === 'pending' ? 'completed' : 'pending';
            const res = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                setTask(updated);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        try {
            await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            navigate('/tasks');
        } catch (err) {
            console.error(err);
        }
    };

    if (!task) return <div style={{ padding: '2rem' }}>Loading task {taskId}...</div>;

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <Link to="/tasks">← Back to Tasks</Link>
                <button onClick={handleDelete} style={{ background: 'red', color: 'white', border: 'none', padding: '8px' }}>Delete Task</button>
            </header>

            <h1>{task.title}</h1>
            <p style={{ color: '#666' }}>{task.description || 'No description provided'}</p>

            <div style={{ margin: '2rem 0', display: 'flex', gap: '1rem' }}>
                <button onClick={toggleStatus} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    Mark as {task.status === 'pending' ? 'Completed' : 'Pending'}
                </button>
                <Link to={`/focus?taskId=${task._id}`} style={{ padding: '10px 20px', background: '#000', color: 'white', textDecoration: 'none' }}>
                    Start Focus Session
                </Link>
            </div>

            <div style={{ borderTop: '1px solid #ccc', paddingTop: '1rem', marginTop: '2rem' }}>
                <p><strong>Route Parameter Demo:</strong> Rendered using parameter `taskId: {taskId}`.</p>
                <p><strong>Status:</strong> {task.status}</p>
                <p><strong>Priority:</strong> {task.priority}</p>
                <p><strong>Subject:</strong> {task.subject}</p>
            </div>
        </div>
    );
};
