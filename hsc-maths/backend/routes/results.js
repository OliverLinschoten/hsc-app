const { requireAuth } = require('../middleware/auth');
const pool = require('../config/db');

const express = require('express');
const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { question_id, topic, correct } = req.body;
    if (!question_id || !topic || correct === undefined) {
      return res.status(400).json({ error: 'question_id, topic and correct are required' });
    }

    await pool.query(
      `INSERT INTO results (user_id, question_id, topic, correct)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, question_id, topic, correct ? true : false]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        r.id,
        r.question_id,
        r.topic,
        r.correct,
        r.answered_at,
        q.paper
       FROM results r
       LEFT JOIN questions q ON r.question_id = q.id
       WHERE r.user_id = $1
       ORDER BY r.answered_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
