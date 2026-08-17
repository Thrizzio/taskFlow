import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── JavaScript Closure: createTaskFilter ──────────────────────────────────────
//
// Outer function: createTaskFilter(statusFilter)
//   Captures: statusFilter (a string) in its lexical scope.
//   Returns:  filterTask — an inner function that closes over statusFilter.
//
// The returned function (filterTask) has permanent access to the statusFilter
// value that was in scope when createTaskFilter was called — this is a closure.
//
// In the useEffect below, React's dependency array [tasks, statusFilter]
// causes a NEW closure to be created whenever statusFilter changes, so
// the filter always observes the current value.
//
// ─────────────────────────────────────────────────────────────────────────────
export function createTaskFilter(statusFilter: string) {
    // Inner function — closes over `statusFilter` from the outer scope.
    return function filterTask(task: Task): boolean {
        return statusFilter === 'all' || task.status === statusFilter;
    };
}
// ─────────────────────────────────────────────────────────────────────────────

interface Task {
    _id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
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

    // ── Closure-backed filtering ───────────────────────────────────────────────
    // Every time `tasks` or `statusFilter` changes, React re-runs this effect.
    // createTaskFilter(statusFilter) creates a fresh closure capturing the new value.
    // tasks.filter(filter) applies that closure to each task.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const filter = createTaskFilter(statusFilter); // returns a closure
        const filtered = tasks.filter(filter);         // closure applied here
        setVisibleTasks(filtered);
    }, [tasks, statusFilter]); // dependency array drives closure freshness

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

            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="New Task Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ flexGrow: 1, padding: '8px' }}
                />
                <button type="submit" style={{ padding: '8px 16px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>Add Task</button>
            </form>

            {/* Status filter — drives the closure in useEffect above */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label htmlFor="statusFilter" style={{ fontWeight: 600 }}>Filter by status:</label>
                <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
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
                {visibleTasks.length === 0 && <p>No tasks match the current filter.</p>}
            </div>
        </div>
    );
};
