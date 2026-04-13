const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { course } = req.query;
    const conditions = [`paper IS NOT NULL`, `paper != ''`];
    const params = [];

    if (course) {
      params.push(course);
      conditions.push(`course = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT paper, COUNT(*) as question_count, SUM(COALESCE(marks, 0)) as total_marks
       FROM questions
       WHERE ${conditions.join(' AND ')}
       GROUP BY paper
       ORDER BY paper ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
