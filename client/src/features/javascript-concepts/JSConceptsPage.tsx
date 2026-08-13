import { useState } from 'react';
import { EventLoopDemo } from './EventLoopDemo';
import { HoistingDemo } from './HoistingDemo';
import { fetchDataCallback, fetchDataPromise } from './promisesVsCallbacks';
import { Link } from 'react-router-dom';

export const JSConceptsPage = () => {
    const [promiseResult, setPromiseResult] = useState('');

    const runCallback = () => {
        setPromiseResult('Running callback...');
        fetchDataCallback(true, (err, data) => {
            if (err) setPromiseResult(err.message);
            else setPromiseResult(data!);
        });
    };

    const runPromise = async () => {
        setPromiseResult('Running promise...');
        try {
            const data = await fetchDataPromise(true);
            setPromiseResult(data);
        } catch (err: any) {
            setPromiseResult(err.message);
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>JavaScript Concepts Hub</h2>
                <Link to="/dashboard">Back to Dashboard</Link>
            </header>

            <p>This module exists purely to demonstrate core JavaScript concepts for viva defense. It avoids mixing these educational demonstrations into production logic.</p>

            <EventLoopDemo />
            <HoistingDemo />

            <div style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
                <h3>Promises vs Callbacks</h3>
                <p>Comparison of async abstractions.</p>
                <button onClick={runCallback} style={{ marginRight: '1rem', padding: '8px' }}>Test Callback</button>
                <button onClick={runPromise} style={{ padding: '8px' }}>Test Promise (async/await)</button>
                <pre style={{ background: '#f5f5f5', padding: '1rem', marginTop: '1rem' }}>
                    {promiseResult || 'Click to test...'}
                </pre>
            </div>

        </div>
    );
};
