import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { API_BASE_URL } from '../config/api';

export interface Task {
    _id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    subject: string;
}

/**
 * JavaScript Closures in Production
 *
 * createTaskFilter returns a new function that closes over `statusFilter`.
 * The returned function retains access to `statusFilter` from its lexical scope
 * even after createTaskFilter has finished executing.
 *
 * When statusFilter changes in React state, the useEffect hook below re-executes
 * createTaskFilter with the new value, creating a fresh closure.
 *
 * Test: server/src/tests/unit/createTaskFilter.test.ts verifies this closure
 * logic in isolation using Vitest.
 */
export function createTaskFilter(statusFilter: string) {
    let currentFilter = statusFilter;

    function filterTask(task: Task): boolean {
        if (currentFilter === 'all') return true;
        return task.status === currentFilter;
    }

    return filterTask;
}

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [visibleTasks, setVisibleTasks] = useState<Task[]>([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [title, setTitle] = useState('');
    const { token } = useAuth();
    const { socket, isConnected } = useSocket();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchTasks = async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/tasks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            } else {
                setErrorMsg('Failed to fetch tasks from server.');
            }
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'Error connecting to server.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [token]);

    // Listen for real-time WebSocket updates to avoid polling
    useEffect(() => {
        if (!socket) return;

        const handleTaskCreated = (newTask: Task) => {
            setTasks((prev) => {
                if (prev.some((t) => t._id === newTask._id)) return prev;
                return [newTask, ...prev];
            });
        };

        const handleTaskUpdated = (updatedTask: Task) => {
            setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)));
        };

        const handleTaskDeleted = ({ taskId }: { taskId: string }) => {
            setTasks((prev) => prev.filter((t) => t._id !== taskId));
        };

        socket.on('task:created', handleTaskCreated);
        socket.on('task:updated', handleTaskUpdated);
        socket.on('task:deleted', handleTaskDeleted);

        return () => {
            socket.off('task:created', handleTaskCreated);
            socket.off('task:updated', handleTaskUpdated);
            socket.off('task:deleted', handleTaskDeleted);
        };
    }, [socket]);

    useEffect(() => {
        const filter = createTaskFilter(statusFilter);
        const filtered = tasks.filter(filter);

        setVisibleTasks(filtered);
    }, [tasks, statusFilter]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/tasks`, {
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
            } else {
                setErrorMsg('Failed to create task.');
            }
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'Error creating task.');
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <style>
                {`
                @media (max-width: 600px) {
                    .task-card {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px;
                    }
                    .header-container {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 10px;
                    }
                    .task-form {
                        flex-direction: column !important;
                    }
                    .filter-container {
                        flex-wrap: wrap;
                    }
                }
                `}
            </style>
            <header className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2>Task Management</h2>
                    <span style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: isConnected ? '#e6f4ea' : '#f1f3f4',
                        color: isConnected ? '#137333' : '#5f6368',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}>
                        <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: isConnected ? '#34a853' : '#9aa0a6'
                        }} />
                        {isConnected ? 'Real-time Live' : 'Connecting...'}
                    </span>
                </div>
                <Link to="/dashboard">Back to Dashboard</Link>
            </header>

            {errorMsg && (
                <div style={{ color: 'red', background: '#ffebee', padding: '10px', borderRadius: '4px', marginBottom: '1rem' }}>
                    {errorMsg}
                </div>
            )}

            {isLoading && (
                <div style={{ color: '#0070f3', padding: '8px 0', marginBottom: '1rem', fontStyle: 'italic' }}>
                    Loading tasks from server...
                </div>
            )}

            <form className="task-form" onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
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

            <div className="filter-container" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                        className="task-card"
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