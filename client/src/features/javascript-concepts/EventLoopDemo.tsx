import { useState } from 'react';

/**
 * Event Loop Demonstration:
 * Demonstrates the ordering of synchronous execution, microtasks (Promises), and macrotasks (setTimeout).
 */
export const EventLoopDemo = () => {
    const [logs, setLogs] = useState<string[]>([]);

    const runDemo = () => {
        const output: string[] = [];
        const log = (msg: string) => output.push(msg);

        log('1. Synchronous: Start');

        setTimeout(() => {
            // Macrotask queue
            log('4. Macrotask (setTimeout): Executed after synchronous and microtasks');
            setLogs([...output]); // Trigger re-render once done
        }, 0);

        Promise.resolve().then(() => {
            // Microtask queue
            log('3. Microtask (Promise.then): Executed before setTimeout');
        });

        log('2. Synchronous: End');

        // Interim render before setTimeout fires
        setLogs([...output]);
    };

    const clear = () => setLogs([]);

    return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
            <h3>Event Loop Demo</h3>
            <p>Observe the execution order between Sync, Microtasks, and Macrotasks.</p>
            <button onClick={runDemo} style={{ marginRight: '1rem', padding: '8px' }}>Run Demo</button>
            <button onClick={clear} style={{ padding: '8px' }}>Clear</button>

            <ul style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem', listStyle: 'none' }}>
                {logs.length === 0 && <li>Execution log empty...</li>}
                {logs.map((log, i) => <li key={i}>{log}</li>)}
            </ul>
        </div>
    );
};
