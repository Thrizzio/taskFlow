/**
 * Promises vs Callbacks Demonstration
 * Showcases the evolution from callback-based async patterns to Promises.
 */

// 1. Callback Approach
export const fetchDataCallback = (
    shouldSucceed: boolean,
    callback: (error: Error | null, data?: string) => void
) => {
    setTimeout(() => {
        if (shouldSucceed) {
            callback(null, 'Data retrieved successfully (via Callback)');
        } else {
            callback(new Error('Operation failed (via Callback)'));
        }
    }, 1000);
};

// 2. Promise Approach
export const fetchDataPromise = (shouldSucceed: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldSucceed) {
                resolve('Data retrieved successfully (via Promise)');
            } else {
                reject(new Error('Operation failed (via Promise)'));
            }
        }, 1000);
    });
};
