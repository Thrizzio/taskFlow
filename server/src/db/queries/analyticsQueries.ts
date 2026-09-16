import { pool } from '../pg';
import { prisma } from '../prisma';

/**
 * Executes a PostgreSQL JOIN operation using raw SQL with node-postgres.
 * Retained to demonstrate raw SQL vs ORM tradeoffs in the analytics pipeline.
 */
export const getTimeSpentPerUserPerTask = async (userId: string) => {
    const query = `
    SELECT
        u.name AS "userName",
        t.title AS "taskTitle",
        SUM(s.duration) AS "totalSeconds"
    FROM users u
    INNER JOIN tasks t 
        ON t.user_id = u.id
    INNER JOIN analytics_sessions s 
        ON s.task_id = t.id
    WHERE u.id = $1
    GROUP BY u.name, t.title
    ORDER BY "totalSeconds" DESC;
  `;
    const result = await pool.query(query, [userId]);
    return result.rows;
};

/**
 * Executes the PostgreSQL JOIN analytics query through Prisma ORM.
 * Demonstrates ORM type-safety, safe parameter binding, and connection management.
 */
export const getTimeSpentPerUserPerTaskPrisma = async (userId: string) => {
    const result = await prisma.$queryRaw<Array<{ userName: string; taskTitle: string; totalSeconds: number }>>`
    SELECT
        u.name AS "userName",
        t.title AS "taskTitle",
        CAST(SUM(s.duration) AS INTEGER) AS "totalSeconds"
    FROM users u
    INNER JOIN tasks t 
        ON t.user_id = u.id
    INNER JOIN analytics_sessions s 
        ON s.task_id = t.id
    WHERE u.id = ${userId}
    GROUP BY u.name, t.title
    ORDER BY "totalSeconds" DESC;
  `;
    return result;
};
