/**
 * Promises vs Callbacks Demonstration
 *
 * Demonstrates:
 * 1. Callback-based asynchronous operations
 * 2. Promise-based asynchronous operations
 * 3. Success handling
 * 4. Error handling
 * 5. Error propagation
 * 6. Promise chaining
 *
 * This file is intentionally isolated from production application logic
 * so the concepts can be demonstrated safely during a viva.
 */

export type Callback<T> = (
    error: Error | null,
    data?: T
) => void;

/* ============================================================
   1. CALLBACK APPROACH
   ============================================================ */

/**
 * Simulates an asynchronous operation using a callback.
 *
 * The callback receives either:
 * - an Error when the operation fails
 * - data when the operation succeeds
 */
export const fetchDataCallback = (
    shouldSucceed: boolean,
    callback: Callback<string>
): void => {
    setTimeout(() => {
        if (shouldSucceed) {
            callback(
                null,
                'Data retrieved successfully via callback.'
            );
        } else {
            callback(
                new Error('Operation failed via callback.')
            );
        }
    }, 500);
};

/**
 * Example callback usage.
 */
export const runCallbackDemo = (
    shouldSucceed: boolean
): void => {
    fetchDataCallback(shouldSucceed, (error, data) => {
        if (error) {
            console.error('Callback error:', error.message);
            return;
        }

        console.log('Callback success:', data);
    });
};


/* ============================================================
   2. PROMISE APPROACH
   ============================================================ */

/**
 * Simulates the same asynchronous operation using a Promise.
 *
 * Success -> resolve()
 * Failure -> reject()
 */
export const fetchDataPromise = (
    shouldSucceed: boolean
): Promise<string> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldSucceed) {
                resolve(
                    'Data retrieved successfully via Promise.'
                );
            } else {
                reject(
                    new Error('Operation failed via Promise.')
                );
            }
        }, 500);
    });
};


/* ============================================================
   3. PROMISE WITH .then() / .catch()
   ============================================================ */

/**
 * Demonstrates Promise success and error propagation.
 */
export const runPromiseDemo = (
    shouldSucceed: boolean
): void => {
    fetchDataPromise(shouldSucceed)
        .then((data) => {
            console.log('Promise success:', data);
            return data;
        })
        .then((data) => {
            console.log('Second Promise step:', data);
        })
        .catch((error: Error) => {
            console.error(
                'Promise error propagated to catch:',
                error.message
            );
        });
};


/* ============================================================
   4. PROMISE WITH async/await
   ============================================================ */

/**
 * Demonstrates how the same Promise can be consumed using
 * async/await and try/catch.
 */
export const runAsyncAwaitDemo = async (
    shouldSucceed: boolean
): Promise<void> => {
    try {
        const data = await fetchDataPromise(shouldSucceed);

        console.log(
            'async/await success:',
            data
        );
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                'async/await error:',
                error.message
            );
        }
    }
};


/* ============================================================
   5. COMPARISON
   ============================================================ */

/**
 * Runs both approaches with the same input.
 *
 * This makes the behavioral difference easy to demonstrate:
 *
 * Callback:
 *     operation -> callback(error, data)
 *
 * Promise:
 *     operation -> resolve(data) / reject(error)
 */
export const runComparisonDemo = (
    shouldSucceed: boolean
): void => {
    console.log('--- CALLBACK APPROACH ---');

    runCallbackDemo(shouldSucceed);

    console.log('--- PROMISE APPROACH ---');

    runPromiseDemo(shouldSucceed);
};