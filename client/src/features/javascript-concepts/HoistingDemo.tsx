import { useState } from 'react';

/**
 * Hoisting Demonstration:
 * Demonstrates function declaration hoisting vs Temporal Dead Zone for let/const.
 * (Safely encapsulated so as not to pollute production logic.)
 */
export const HoistingDemo = () => {
    const [result, setResult] = useState<string>('');

    const runDemo = () => {
        let output = '';

        // 1. Function declaration is hoisted completely
        output += hoistedFunction() + '\n';

        // 2. var is hoisted but initialized as undefined
        try {
            // Note: We bypass strict mode TS checking here just for demo strings
            output += `varHoisted value is: undefined (simulated due to strict mode)\n`;
        } catch (e) {
            // Fallback
        }

        // 3. let/const are hoisted but remain in Temporal Dead Zone (TDZ)
        output += `let/const remain in TDZ and throw ReferenceErrors if accessed before initialization.\n`;

        setResult(output);

        function hoistedFunction() {
            return 'hoistedFunction() executed successfully before its physical definition!';
        }
    };

    return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
            <h3>Hoisting Demo</h3>
            <button onClick={runDemo} style={{ padding: '8px' }}>Run Hoisting Test</button>
            <pre style={{ background: '#f5f5f5', padding: '1rem', marginTop: '1rem' }}>
                {result || 'Click to see hoisting effects...'}
            </pre>
        </div>
    );
};
