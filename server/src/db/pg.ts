import { Pool } from 'pg';
import config from '../utils/config';

export const pool = new Pool({
    connectionString: config.POSTGRES_DATABASE_URL
});

export const initPgDB = async () => {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id SERIAL PRIMARY KEY,
        task_id VARCHAR(255) REFERENCES tasks(id),
        user_id VARCHAR(255) REFERENCES users(id),
        duration INTEGER NOT NULL,
        started_at TIMESTAMP,
        ended_at TIMESTAMP
      );
    `);
        console.log('PostgreSQL schema initialized');
    } catch (err) {
        console.error('Failed to initialize PostgreSQL schema:', err);
        // Don't crash prototype, DB might be unavailable locally
    }
};
