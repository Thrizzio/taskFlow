export const fetchDataCallback = (shouldSucceed, callback) => {
    setTimeout(() => {
        if (shouldSucceed) {
            callback(null, 'Data retrieved successfully.');
        } else {
            callback(new Error('Failed to retrieve data.'));
        }
    }, 500);
};

export const runCallbackExample = (shouldSucceed) => {
    fetchDataCallback(shouldSucceed, (error, data) => {
        if (error) {
            console.error('Callback error:', error.message);
            return;
        }

        console.log('Callback result:', data);
    });
};

export const fetchUser = (shouldSucceed) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldSucceed) {
                resolve('User data retrieved.');
            } else {
                reject(new Error('Failed to retrieve user.'));
            }
        }, 500);
    });
};

export const processUser = (user) => {
    return Promise.resolve(`${user} processed.`);
};

export const saveUser = (user) => {
    return Promise.resolve(`${user} saved successfully.`);
};

export const runPromiseExample = (shouldSucceed) => {
    fetchUser(shouldSucceed)
        .then((user) => processUser(user))
        .then((processedUser) => saveUser(processedUser))
        .then((result) => {
            console.log('Promise chain result:', result);
        })
        .catch((error) => {
            console.error('Promise chain error:', error.message);
        });
};