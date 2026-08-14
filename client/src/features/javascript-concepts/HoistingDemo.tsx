import { useState } from 'react';

type DemoResult = {
    title: string;
    code: string;
    result: string;
};

export const HoistingDemo = () => {
    const [results, setResults] = useState<DemoResult[]>([]);

    const runFunctionHoisting = () => {
        const code = `sayHello();

function sayHello() {
    return "Hello from a hoisted function!";
}`;

        function sayHello() {
            return 'Hello from a hoisted function!';
        }

        let result: string;

        try {
            // The function is called before its declaration.
            result = sayHello();
        } catch (error) {
            result = `Error: ${error}`;
        }

        setResults((previous) => [
            ...previous,
            {
                title: 'Function Declaration Hoisting',
                code,
                result,
            },
        ]);
    };

    const runVarHoisting = () => {
        const code = `console.log(value);

var value = 10;`;

        let result: string;

        try {
            // We demonstrate the behavior without relying on
            // TypeScript's compile-time restrictions.
            result = 'undefined';

            let value: number | undefined;

            // Simulates the state of `var value` before assignment.
            value = undefined;

            result = String(value);
        } catch (error) {
            result = `Error: ${error}`;
        }

        setResults((previous) => [
            ...previous,
            {
                title: 'var Hoisting',
                code,
                result,
            },
        ]);
    };

    const runTDZDemo = () => {
        const code = `console.log(value);

let value = 10;`;

        let result: string;

        try {
            // We cannot directly execute the example because
            // TypeScript's compiler/runtime would reject it.
            //
            // Instead, we demonstrate the actual runtime behavior
            // using an isolated dynamically evaluated function.

            const demo = new Function(`
                console.log(value);
                let value = 10;
            `);

            demo();

            result = 'No error';
        } catch (error) {
            result =
                error instanceof Error
                    ? `${error.name}: ${error.message}`
                    : String(error);
        }

        setResults((previous) => [
            ...previous,
            {
                title: 'let / const Temporal Dead Zone',
                code,
                result,
            },
        ]);
    };

    const clearResults = () => {
        setResults([]);
    };

    return (
        <div
            style={{
                border: '1px solid #ccc',
                padding: '1.5rem',
                margin: '1rem 0',
                borderRadius: '8px',
            }}
        >
            <h3>JavaScript Hoisting Demo</h3>

            <p>
                These examples demonstrate function declaration hoisting,
                <code> var </code>
                hoisting, and the Temporal Dead Zone for
                <code> let </code>
                and
                <code> const </code>.
            </p>

            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginTop: '1rem',
                }}
            >
                <button onClick={runFunctionHoisting}>
                    Run Function Hoisting
                </button>

                <button onClick={runVarHoisting}>
                    Run var Hoisting
                </button>

                <button onClick={runTDZDemo}>
                    Run let / const TDZ
                </button>

                <button onClick={clearResults}>
                    Clear
                </button>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                {results.map((demo, index) => (
                    <div
                        key={`${demo.title}-${index}`}
                        style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: '#f5f5f5',
                            borderRadius: '6px',
                        }}
                    >
                        <h4>{demo.title}</h4>

                        <p>
                            <strong>Code:</strong>
                        </p>

                        <pre
                            style={{
                                background: '#222',
                                color: '#fff',
                                padding: '1rem',
                                borderRadius: '4px',
                                overflowX: 'auto',
                            }}
                        >
                            {demo.code}
                        </pre>

                        <p>
                            <strong>Actual result:</strong>
                        </p>

                        <pre
                            style={{
                                background: '#fff',
                                padding: '1rem',
                                borderRadius: '4px',
                            }}
                        >
                            {demo.result}
                        </pre>
                    </div>
                ))}
            </div>
        </div>
    );
};