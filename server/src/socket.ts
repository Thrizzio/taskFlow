import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from './utils/config';

let ioInstance: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            userId: string;
            name: string;
            role: 'user' | 'admin';
        };
    };
}

/**
 * JWT authentication middleware for Socket.IO handshake.
 * Rejects connections without a valid JWT bearer token.
 */
export function authenticateSocketHandshake(socket: Socket, next: (err?: any) => void): void {
    const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization
            ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
            : null);

    if (!token) {
        return next(new Error('Authentication error: missing token'));
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET as string) as any;
        (socket as AuthenticatedSocket).data.user = {
            userId: decoded.userId,
            name: decoded.name,
            role: decoded.role || 'user',
        };
        next();
    } catch (err: any) {
        return next(new Error('Authentication error: invalid or expired token'));
    }
}

/**
 * Handles newly connected authenticated sockets by routing to user-scoped rooms.
 */
export function handleSocketConnection(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.data.user?.userId;

    if (userId) {
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        if (process.env.NODE_ENV !== 'test') {
            console.log(`[Socket] User "${userId}" connected (socket ID: ${socket.id}) and joined room "${userRoom}"`);
        }
    }

    socket.on('disconnect', () => {
        if (process.env.NODE_ENV !== 'test') {
            console.log(`[Socket] Socket "${socket.id}" disconnected`);
        }
    });
}

/**
 * Initializes Socket.IO with HTTP server, enforcing JWT authentication during handshake
 * and routing users to private user-scoped rooms (`user:${userId}`).
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
    ioInstance = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    ioInstance.use(authenticateSocketHandshake);
    ioInstance.on('connection', handleSocketConnection);

    return ioInstance;
}

export const getSocketIO = (): SocketIOServer | null => ioInstance;

/**
 * Testing helper to inject or mock the Socket.IO instance
 */
export function setSocketIOForTesting(mockIo: any): void {
    ioInstance = mockIo;
}

/**
 * Testing helper to close Socket.IO server cleanly
 */
export async function closeSocketServer(): Promise<void> {
    if (ioInstance) {
        await new Promise<void>((resolve) => {
            ioInstance!.close(() => resolve());
        });
        ioInstance = null;
    }
}

// ── Typed Broadcast Helpers ──────────────────────────────────────────────────

export function emitTaskCreated(userId: string, task: any): void {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('task:created', task);
}

export function emitTaskUpdated(userId: string, task: any): void {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('task:updated', task);
}

export function emitTaskDeleted(userId: string, taskId: string): void {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('task:deleted', { taskId });
}

export function emitFocusSessionCompleted(userId: string, session: any): void {
    if (!ioInstance) return;
    ioInstance.to(`user:${userId}`).emit('focus:completed', session);
}
