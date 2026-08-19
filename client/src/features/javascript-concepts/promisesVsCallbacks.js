export const fetchUserWithCallback = (shouldSucceed, callback) => {
    setTimeout(() => {
        if (!shouldSucceed) {
            callback(new Error('Failed to fetch user.'));
            return;
        }

        const user = { id: 1, name: 'Aadi' };

        setTimeout(() => {
            const processedUser = {
                ...user,
                processed: true
            };

            setTimeout(() => {
                callback(null, 'User saved successfully.');
            }, 300);
        }, 300);
    }, 300);
};

export const runCallbackExample = (shouldSucceed) => {
    fetchUserWithCallback(shouldSucceed, (error, result) => {
        if (error) {
            console.error('Callback error:', error.message);
            return;
        }

        console.log('Callback result:', result);
    });
};

export const runPromiseExample = (shouldSucceed) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!shouldSucceed) {
                reject(new Error('Failed to fetch user.'));
                return;
            }

            resolve({ id: 1, name: 'Aadi' });
        }, 300);
    })
        .then((user) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        ...user,
                        processed: true
                    });
                }, 300);
            });
        })
        .then((processedUser) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve('User saved successfully.');
                }, 300);
            });
        })
        .then((result) => {
            console.log('Promise result:', result);
        })
        .catch((error) => {
            console.error('Promise error:', error.message);
        });
};