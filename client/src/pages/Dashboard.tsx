import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ margin: 0 }}>FocusFlow Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Welcome, {user?.name}</span>
                    <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
                </div>
            </header>

            <main style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <Link to="/tasks" style={{ padding: '1rem', border: '1px solid #ccc', textDecoration: 'none', color: 'inherit' }}>
                    <h3>Task Management &rarr;</h3>
                    <p>Create and view your tasks</p>
                </Link>
                <Link to="/analytics" style={{ padding: '1rem', border: '1px solid #ccc', textDecoration: 'none', color: 'inherit' }}>
                    <h3>Analytics &rarr;</h3>
                    <p>View your focus time</p>
                </Link>
                <Link to="/javascript-concepts" style={{ padding: '1rem', border: '1px solid #ccc', textDecoration: 'none', color: 'inherit' }}>
                    <h3>JS Concepts Demo &rarr;</h3>
                    <p>Technical demonstration page</p>
                </Link>
            </main>
        </div>
    );
};
