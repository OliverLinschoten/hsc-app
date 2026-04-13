const pool = require('../config/db');

const express = require('express');
const router = express.Router();

router.get('/students', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.created_at,
        COUNT(r.id) as total_attempts,
        SUM(CASE WHEN r.correct THEN 1 ELSE 0 END) as correct,
        CASE WHEN COUNT(r.id) > 0
          THEN ROUND(100.0 * SUM(CASE WHEN r.correct THEN 1 ELSE 0 END) / COUNT(r.id), 1)
          ELSE 0
        END as accuracy
       FROM users u
       LEFT JOIN results r ON u.id = r.user_id
       WHERE u.role = 'student'
       GROUP BY u.id, u.email, u.created_at
       ORDER BY u.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;