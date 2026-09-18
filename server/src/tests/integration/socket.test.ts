/**
 * Integration tests: Real-time WebSocket Layer (Socket.IO)
 *
 * Verifies:
 * 1. Connection Handshake Authentication:
 *    - Rejects with authentication error when JWT token is missing.
 *    - Rejects with authentication error when JWT token is invalid or expired.
 *    - Successfully authenticates and attaches user claims when valid JWT token is provided
 *      either via `auth.token` or `headers.authorization`.
 * 2. Room Routing and Isolation:
 *    - Automatically binds authenticated sockets to private user rooms (`user:${userId}`).
 *    - Verifies event broadcasts targeting User A are delivered only to User A's room and
 *      isolated from other users.
 * 3. Event Emitters:
 *    - Verifies payload delivery for `emitTaskCreated`, `emitTaskUpdated`,
 *      `emitTaskDeleted`, and `emitFocusSessionCompleted`.
 *    - Ensures graceful no-op behavior when Socket.IO server is not yet initialized.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
    authenticateSocketHandshake,
    handleSocketConnection,
    setSocketIOForTesting,
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitFocusSessionCompleted,
} from '../../socket';

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-socket-secret-key-12345',
    },
    validateEnv: vi.fn(),
}));

describe('WebSocket Authentication Handshake', () => {
    const validToken = jwt.sign(
        { userId: 'user-42', name: 'Ada Lovelace', role: 'user' },
        'test-socket-secret-key-12345'
    );

    it('rejects handshake when token is missing in both auth and headers', () => {
        const mockSocket: any = {
            handshake: {
                auth: {},
                headers: {},
            },
            data: {},
        };
        const next = vi.fn();

        authenticateSocketHandshake(mockSocket, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Authentication error: missing token');
        expect(mockSocket.data.user).toBeUndefined();
    });

    it('rejects handshake when token is malformed or invalid', () => {
        const mockSocket: any = {
            handshake: {
                auth: { token: 'malformed-jwt-token' },
                headers: {},
            },
            data: {},
        };
        const next = vi.fn();

        authenticateSocketHandshake(mockSocket, next);

        expect(next).toHaveBeenCalledTimes(1);
        const err = next.mock.calls[0][0];
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Authentication error: invalid or expired token');
    });

    it('authenticates successfully via auth.token and attaches user to socket data', () => {
        const mockSocket: any = {
            handshake: {
                auth: { token: validToken },
                headers: {},
            },
            data: {},
        };
        const next = vi.fn();

        authenticateSocketHandshake(mockSocket, next);

        expect(next).toHaveBeenCalledWith(); // called without error
        expect(mockSocket.data.user).toEqual({
            userId: 'user-42',
            name: 'Ada Lovelace',
            role: 'user',
        });
    });

    it('authenticates successfully via headers.authorization Bearer token', () => {
        const mockSocket: any = {
            handshake: {
                auth: {},
                headers: { authorization: `Bearer ${validToken}` },
            },
            data: {},
        };
        const next = vi.fn();

        authenticateSocketHandshake(mockSocket, next);

        expect(next).toHaveBeenCalledWith();
        expect(mockSocket.data.user.userId).toBe('user-42');
    });
});

describe('WebSocket Room Joining and Isolation', () => {
    it('joins user-scoped private room upon connection', () => {
        const mockSocket: any = {
            id: 'socket-abc-123',
            data: {
                user: { userId: 'user-77', name: 'Alan Turing', role: 'user' },
            },
            join: vi.fn(),
            on: vi.fn(),
        };

        handleSocketConnection(mockSocket);

        expect(mockSocket.join).toHaveBeenCalledWith('user:user-77');
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
});

describe('WebSocket Real-Time Event Emitters', () => {
    let mockIo: any;
    let roomEmits: Record<string, Array<{ event: string; payload: any }>>;

    beforeEach(() => {
        roomEmits = {};
        mockIo = {
            to: vi.fn((room: string) => ({
                emit: vi.fn((event: string, payload: any) => {
                    if (!roomEmits[room]) roomEmits[room] = [];
                    roomEmits[room].push({ event, payload });
                }),
            })),
        };
        setSocketIOForTesting(mockIo);
    });

    it('emits task:created to the user-scoped room only', () => {
        const task = { _id: 'task-1', title: 'Real-time WebSocket implementation' };
        emitTaskCreated('user-100', task);

        expect(mockIo.to).toHaveBeenCalledWith('user:user-100');
        expect(roomEmits['user:user-100']).toEqual([{ event: 'task:created', payload: task }]);
        expect(roomEmits['user:user-200']).toBeUndefined();
    });

    it('emits task:updated to the user-scoped room only', () => {
        const updatedTask = { _id: 'task-1', status: 'completed' };
        emitTaskUpdated('user-100', updatedTask);

        expect(mockIo.to).toHaveBeenCalledWith('user:user-100');
        expect(roomEmits['user:user-100']).toEqual([{ event: 'task:updated', payload: updatedTask }]);
    });

    it('emits task:deleted to the user-scoped room with taskId', () => {
        emitTaskDeleted('user-100', 'task-1');

        expect(mockIo.to).toHaveBeenCalledWith('user:user-100');
        expect(roomEmits['user:user-100']).toEqual([{ event: 'task:deleted', payload: { taskId: 'task-1' } }]);
    });

    it('emits focus:completed to the user-scoped room', () => {
        const session = { _id: 'session-5', duration: 1500 };
        emitFocusSessionCompleted('user-100', session);

        expect(mockIo.to).toHaveBeenCalledWith('user:user-100');
        expect(roomEmits['user:user-100']).toEqual([{ event: 'focus:completed', payload: session }]);
    });

    it('handles uninitialized socket server gracefully without throwing errors', () => {
        setSocketIOForTesting(null);

        expect(() => emitTaskCreated('user-100', {})).not.toThrow();
        expect(() => emitTaskUpdated('user-100', {})).not.toThrow();
        expect(() => emitTaskDeleted('user-100', 'task-1')).not.toThrow();
        expect(() => emitFocusSessionCompleted('user-100', {})).not.toThrow();
    });
});
