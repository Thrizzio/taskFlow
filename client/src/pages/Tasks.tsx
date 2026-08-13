import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Task {
    _id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
}

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [title, setTitle] = useState('');
    const { token } = useAuth();

    const fetchTasks = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/tasks', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [token]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;

        try {
            const res = await fetch('http://localhost:4000/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, priority: 'medium', subject: 'general' })
            });

            if (res.ok) {
                setTitle('');
                fetchTasks();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>Task Management</h2>
                <Link to="/dashboard">Back to Dashboard</Link>
            </header>

            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <input
                    type="text"
                    placeholder="New Task Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ flexGrow: 1, padding: '8px' }}
                />
                <button type="submit" style={{ padding: '8px 16px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>Add Task</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {tasks.map(task => (
                    <div key={task._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #ccc' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0' }}>{task.title}</h3>
                            <span style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#eee', borderRadius: '4px' }}>
                                {task.status} | {task.priority}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Link to={`/tasks/${task._id}`} style={{ padding: '8px 16px', textDecoration: 'none', background: '#e0e0e0', color: 'black' }}>
                                Open Task
                            </Link>
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && <p>No tasks yet. Create one above!</p>}
            </div>
        </div>
    );
};
