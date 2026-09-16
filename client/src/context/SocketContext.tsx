import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const { token, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || !token) {
            return;
        }

        const newSocket = io(API_BASE_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [token, isAuthenticated]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
