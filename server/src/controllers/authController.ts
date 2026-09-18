import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import config from '../utils/config';
import { getGoogleOAuthURL, exchangeCodeForGoogleUser } from '../utils/oauth';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            res.status(400).json({ error: 'Email, password, and name are required' });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ error: 'Email already in use' });
            return;
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = new User({
            email,
            passwordHash,
            name,
            role: 'user',
        });

        const savedUser = await user.save();

        const token = jwt.sign(
            { userId: savedUser._id, name: savedUser.name, role: savedUser.role || 'user' },
            config.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        res.status(201).json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email, role: savedUser.role || 'user' } });
    } catch (error) {
        // We intentionally don't leak stack traces
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const passwordCorrect = await bcrypt.compare(password, user.passwordHash as string);
        if (!passwordCorrect) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = jwt.sign(
            { userId: user._id, name: user.name, role: user.role || 'user' },
            config.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role || 'user' } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
};

export const googleAuthUrl = (_req: Request, res: Response): void => {
    try {
        const url = getGoogleOAuthURL();
        res.json({ url });
    } catch (error) {
        console.error('googleAuthUrl error:', error);
        res.status(500).json({ error: 'Failed to generate Google auth URL' });
    }
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const code = (req.body?.code || req.query?.code) as string;
        if (!code) {
            res.status(400).json({ error: 'Authorization code is required' });
            return;
        }

        const googleUser = await exchangeCodeForGoogleUser(code);

        // Find existing user by googleId or registered email
        let user = await User.findOne({
            $or: [{ googleId: googleUser.id }, { email: googleUser.email.toLowerCase() }]
        });

        if (user) {
            // Link Google ID if user registered locally with the same email
            if (!user.googleId) {
                user.googleId = googleUser.id;
                await user.save();
            }
        } else {
            // Create new OAuth-backed user
            user = new User({
                email: googleUser.email.toLowerCase(),
                name: googleUser.name,
                googleId: googleUser.id,
                authProvider: 'google',
                role: 'user',
            });
            await user.save();
        }

        const token = jwt.sign(
            { userId: user._id, name: user.name, role: user.role || 'user' },
            config.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role || 'user',
            }
        });
    } catch (error: any) {
        console.error('googleCallback error:', error);
        res.status(400).json({ error: error.message || 'Google authentication failed' });
    }
};
