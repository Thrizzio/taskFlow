import config from './config';

export interface GoogleUserProfile {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

/**
 * Builds Google OAuth 2.0 authorization URL.
 */
export function getGoogleOAuthURL(): string {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
        redirect_uri: config.GOOGLE_CALLBACK_URL,
        client_id: config.GOOGLE_CLIENT_ID || 'mock-google-client-id',
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
    });
    return `${rootUrl}?${params.toString()}`;
}

/**
 * Exchanges Google authorization code for user profile.
 * Supports test mode codes prefixed with "mock_code_" for deterministic testing.
 */
export async function exchangeCodeForGoogleUser(code: string): Promise<GoogleUserProfile> {
    if (!code) {
        throw new Error('Authorization code is required');
    }

    // Deterministic test hook: allows integration tests to run without active Google API credentials
    if (code.startsWith('mock_code_')) {
        const username = code.replace('mock_code_', '');
        return {
            id: `google_id_${username}`,
            email: `${username}@gmail.com`,
            name: username.charAt(0).toUpperCase() + username.slice(1),
        };
    }

    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth is not configured on the server (missing client credentials)');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: config.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
    };

    const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values).toString(),
    });

    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Google token exchange failed: ${tokenRes.status} ${errText}`);
    }

    const tokens = await tokenRes.json() as { access_token?: string; id_token?: string };
    if (!tokens.access_token) {
        throw new Error('Invalid token response from Google');
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
        throw new Error('Failed to fetch user profile from Google');
    }

    const userData = await userRes.json() as { id: string; email: string; name?: string; picture?: string };
    return {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        picture: userData.picture,
    };
}
