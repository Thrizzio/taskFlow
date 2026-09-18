/**
 * Promises vs Callbacks comparison utilities.
 */

export const fetchDataCallback = (
    shouldSucceed: boolean,
    callback: (err: Error | null, data?: string) => void
): void => {
    setTimeout(() => {
        if (!shouldSucceed) {
            callback(new Error('Callback failed to fetch data.'));
            return;
        }
        callback(null, 'Callback successfully fetched user data after 300ms.');
    }, 300);
};

export const fetchDataPromise = (shouldSucceed: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!shouldSucceed) {
                reject(new Error('Promise failed to fetch data.'));
                return;
            }
            resolve('Promise (async/await) successfully resolved user data.');
        }, 300);
    });
};

