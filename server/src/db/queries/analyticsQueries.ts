import { pool } from '../pg';

/**
 * Executes a PostgreSQL JOIN operation.
 * Requirement: Demonstrate a real SQL JOIN query.
 * Why JOIN?: We store user names centrally in users, titles in tasks, 
 * but performance-optimally want a consolidated report of 'How much time 
 * did each user spend on each task?'.
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
