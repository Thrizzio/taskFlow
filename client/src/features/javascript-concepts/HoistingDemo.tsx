import { useState } from 'react';

/**
 * Demonstrates hoisting behavior:
 * - Function declarations: callable before declaration
 * - var: hoisted and initialized to undefined
 * - let / const: hoisted but in Temporal Dead Zone (TDZ)
 */
export const HoistingDemo = () => {
    const [result, setResult] = useState<string>('');

    const runDemo = () => {
        const lines: string[] = [];

        // 1. Function declaration hoisting
        lines.push(`1. Function declaration: ${declaredFunction()}`);

        function declaredFunction() {
            return 'Declared functions are hoisted with definition.';
        }

        // 2. var hoisting demonstration
        // @ts-ignore
        var hoistedVar;
        lines.push(`2. var before assignment: ${String(hoistedVar)} (initialized to undefined)`);
        hoistedVar = 'Assigned value';
        lines.push(`   var after assignment: ${hoistedVar}`);

        // 3. let / const TDZ
        lines.push('3. let / const: Exist in Temporal Dead Zone (TDZ) before initialization (ReferenceError if accessed)');

        setResult(lines.join('\n'));
    };

    return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
            <h3>Hoisting Demonstration</h3>
            <p>Compares function declarations, <code>var</code>, and <code>let/const</code> TDZ.</p>
            <button onClick={runDemo} style={{ padding: '8px' }}>Test Hoisting</button>
            <pre style={{ background: '#f5f5f5', padding: '1rem', marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
                {result || 'Click to run hoisting demo...'}
            </pre>
        </div>
    );
};

