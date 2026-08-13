import { pool } from '../pg';

/**
 * Executes a PostgreSQL JOIN operation.
 * Requirement: Demonstrate a real SQL JOIN query.
 * Why JOIN?: We store user names centrally in users, titles in tasks, 
 * but performance-optimally want a consolidated report of 'How much time 
 * did each user spend on each task?'.
 */
export const getTimeSpentPerUserPerTask = async () => {
    const query = `
    SELECT
        u.name AS "userName",
        t.title AS "taskTitle",
        SUM(s.duration) AS "totalSeconds"
    FROM users u
    JOIN tasks t 
        ON t.user_id = u.id
    JOIN analytics_sessions s 
        ON s.task_id = t.id
    GROUP BY u.name, t.title
    ORDER BY "totalSeconds" DESC;
  `;
    const result = await pool.query(query);
    return result.rows;
};
