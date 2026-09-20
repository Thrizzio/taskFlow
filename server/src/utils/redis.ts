import Redis from 'ioredis';
import config from './config';

let redisClient: Redis | null = null;
let isConnected = false;

try {
    redisClient = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Do not endlessly retry if Redis is not running locally
    });

    redisClient.on('connect', () => {
        isConnected = true;
        console.log('Connected to Redis cache');
    });

    redisClient.on('error', (err) => {
        isConnected = false;
        // Graceful fallback: log warning without crashing server
        if (process.env.NODE_ENV !== 'test') {
            console.warn('Redis unavailable, falling back to direct database queries:', err.message);
        }
    });

    // Attempt initial connection without blocking boot
    redisClient.connect().catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
            console.warn('Redis connection deferred / offline:', err.message);
        }
    });
} catch (err: any) {
    console.warn('Redis initialization skipped:', err.message);
    redisClient = null;
}

export const getRedisClient = () => redisClient;

/**
 * Test helper to inject mock Redis client in offline test suites
 */
export function setRedisClientForTesting(client: any, connected: boolean = true) {
    redisClient = client;
    isConnected = connected;
}

/**
 * Invalidate a single cache key.
 */
export async function invalidateCacheKey(key: string): Promise<void> {
    if (!redisClient || !isConnected) return;

    try {
        await redisClient.del(key);
    } catch (err) {
        console.warn(`Redis DEL failed for key "${key}":`, (err as any).message);
    }
}
export async function getCachedJson<T>(key: string): Promise<T | null> {
    if (!redisClient || !isConnected) return null;

    try {
        const raw = await redisClient.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch (err) {
        console.warn(`Redis GET failed for key "${key}", falling back to DB:`, (err as any).message);
        return null;
    }
}

/**
 * Serializes and stores data in Redis with a TTL in seconds.
 * Fails silently to ensure application availability.
 */
export async function setCachedJson(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    if (!redisClient || !isConnected) return;

    try {
        const serialized = JSON.stringify(data);
        await redisClient.setex(key, ttlSeconds, serialized);
    } catch (err) {
        console.warn(`Redis SETEX failed for key "${key}":`, (err as any).message);
    }
}

/**
 * Invalidates cache keys matching a specific pattern (e.g. analytics:user:123:*).
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
    if (!redisClient || !isConnected) return;

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(...keys);
        }
    } catch (err) {
        console.warn(`Redis cache invalidation failed for pattern "${pattern}":`, (err as any).message);
    }
}
