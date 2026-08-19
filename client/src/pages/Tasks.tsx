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

/*
    CLOSURE

    createTaskFilter() is the outer function.
    statusFilter belongs to its lexical scope.

    It returns filterTask(), an inner function that uses
    statusFilter even after createTaskFilter() has finished.

    Therefore filterTask() closes over statusFilter.

    Example:

        const filter = createTaskFilter('pending');

        filter(task);

    The returned filter function remembers that statusFilter
    was 'pending'.
*/
export function createTaskFilter(statusFilter: string) {
    let currentFilter = statusFilter;

    function filterTask(task: Task): boolean {
        return currentFilter === 'all' || task.status === currentFilter;
    }

    return filterTask;
}

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [visibleTasks, setVisibleTasks] = useState<Task[]>([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [title, setTitle] = useState('');
    const { token } = useAuth();

    const fetchTasks = async () => {
        try {
            const res = await fetch('http://localhost:4000/api/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
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

    useEffect(() => {
        const filter = createTaskFilter(statusFilter);
        const filtered = tasks.filter(filter);

        setVisibleTasks(filtered);
    }, [tasks, statusFilter]);

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
                body: JSON.stringify({
                    title,
                    priority: 'medium',
                    subject: 'general'
                })
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

            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="New Task Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ flexGrow: 1, padding: '8px' }}
                />
                <button
                    type="submit"
                    style={{
                        padding: '8px 16px',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    Add Task
                </button>
            </form>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label htmlFor="statusFilter" style={{ fontWeight: 600 }}>
                    Filter by status:
                </label>

                <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc'
                    }}
                >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                </select>

                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    Showing {visibleTasks.length} of {tasks.length} tasks
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {visibleTasks.map(task => (
                    <div
                        key={task._id}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '1rem',
                            border: '1px solid #ccc'
                        }}
                    >
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0' }}>
                                {task.title}
                            </h3>

                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '4px 8px',
                                    background: '#eee',
                                    borderRadius: '4px'
                                }}
                            >
                                {task.status} | {task.priority}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Link
                                to={`/tasks/${task._id}`}
                                style={{
                                    padding: '8px 16px',
                                    textDecoration: 'none',
                                    background: '#e0e0e0',
                                    color: 'black'
                                }}
                            >
                                Open Task
                            </Link>
                        </div>
                    </div>
                ))}

                {visibleTasks.length === 0 && (
                    <p>No tasks match the current filter.</p>
                )}
            </div>
        </div>
    );
};