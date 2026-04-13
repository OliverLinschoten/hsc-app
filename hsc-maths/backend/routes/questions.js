const { requireAuth, requireAdmin } = require('../middleware/auth');
const pool = require('../config/db');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const COURSES = require('../constants/courses');

const cloudinary = require('cloudinary').v2;
const { uploadToCloudinary, getPublicId } = require('../config/cloudinary');

const express = require('express');
const router = express.Router();

router.get('/random', requireAuth, async (req, res) => {
  try {
    const { topic, course } = req.query;
    const conditions = [];
    const params = [];

    if (course) {
      params.push(course);
      conditions.push(`course = $${params.length}`);
    }
    if (topic && topic !== 'all') {
      const topics = topic.split(',').map(t => t.trim()).filter(Boolean);
      const placeholders = topics.map((t, i) => {
        params.push(t);
        return `$${params.length}`;
      });
      conditions.push(`topic IN (${placeholders.join(', ')})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM questions ${where} ORDER BY RANDOM() LIMIT 1`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No questions found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { topic, course } = req.query;
    const conditions = [];
    const params = [];

    if (course) {
      params.push(course);
      conditions.push(`course = $${params.length}`);
    }
    if (topic && topic !== 'all') {
      const topics = topic.split(',').map(t => t.trim()).filter(Boolean);
      const placeholders = topics.map((t, i) => {
        params.push(t);
        return `$${params.length}`;
      });
      conditions.push(`topic IN (${placeholders.join(', ')})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM questions ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});


router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', requireAdmin, upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { topic, paper, marks, question_number, course } = req.body;

    if (!req.files?.question_image) {
      return res.status(400).json({ error: 'Question image is required' });
    }

    const validTopics = course && COURSES[course]
      ? COURSES[course]
      : Object.values(COURSES).flat();

    if (!topic || !validTopics.includes(topic)) {
      return res.status(400).json({ error: 'Valid topic is required' });
    }

    const question_image = await uploadToCloudinary(req.files.question_image[0].buffer);
    const answer_image = req.files?.answer_image
      ? await uploadToCloudinary(req.files.answer_image[0].buffer)
      : null;

    const result = await pool.query(
      `INSERT INTO questions (topic, paper, marks, question_number, course, question_image, answer_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        topic,
        paper || '',
        marks ? parseInt(marks) : null,
        question_number ? parseInt(question_number) : null,
        course || 'Standard 2',
        question_image,
        answer_image
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', requireAdmin, upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM questions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
 
    const old = existing.rows[0];
    const { topic, paper, marks, question_number, course } = req.body;
 
    // If new images uploaded, upload to Cloudinary and delete old ones
    let question_image = old.question_image;
    if (req.files?.question_image) {
      question_image = await uploadToCloudinary(req.files.question_image[0].buffer);
      if (old.question_image) cloudinary.uploader.destroy(getPublicId(old.question_image));
    }
 
    let answer_image = old.answer_image;
    if (req.files?.answer_image) {
      answer_image = await uploadToCloudinary(req.files.answer_image[0].buffer);
      if (old.answer_image) cloudinary.uploader.destroy(getPublicId(old.answer_image));
    }
 
    const result = await pool.query(
      `UPDATE questions
       SET topic = $1, paper = $2, marks = $3, question_number = $4, course = $5,
           question_image = $6, answer_image = $7
       WHERE id = $8
       RETURNING *`,
      [
        topic || old.topic,
        paper !== undefined ? paper : old.paper,
        marks ? parseInt(marks) : old.marks,
        question_number ? parseInt(question_number) : old.question_number,
        course || old.course,
        question_image,
        answer_image,
        req.params.id
      ]
    );
 
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', requireAdmin, upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM questions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
 
    const old = existing.rows[0];
    const { topic, paper, marks, question_number, course } = req.body;
 
    // If new images uploaded, upload to Cloudinary and delete old ones
    let question_image = old.question_image;
    if (req.files?.question_image) {
      question_image = await uploadToCloudinary(req.files.question_image[0].buffer);
      if (old.question_image) cloudinary.uploader.destroy(getPublicId(old.question_image));
    }
 
    let answer_image = old.answer_image;
    if (req.files?.answer_image) {
      answer_image = await uploadToCloudinary(req.files.answer_image[0].buffer);
      if (old.answer_image) cloudinary.uploader.destroy(getPublicId(old.answer_image));
    }
 
    const result = await pool.query(
      `UPDATE questions
       SET topic = $1, paper = $2, marks = $3, question_number = $4, course = $5,
           question_image = $6, answer_image = $7
       WHERE id = $8
       RETURNING *`,
      [
        topic || old.topic,
        paper !== undefined ? paper : old.paper,
        marks ? parseInt(marks) : old.marks,
        question_number ? parseInt(question_number) : old.question_number,
        course || old.course,
        question_image,
        answer_image,
        req.params.id
      ]
    );
 
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
 

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM questions WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const q = result.rows[0];

    [q.question_image, q.answer_image].forEach(url => {
      if (url) cloudinary.uploader.destroy(getPublicId(url));
    });

    await pool.query('DELETE FROM questions WHERE id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/paper/:paper', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM questions
       WHERE paper = $1
       ORDER BY question_number ASC NULLS LAST, id ASC`,
      [req.params.paper]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});



module.exports = router;