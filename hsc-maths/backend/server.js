require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sql = require('mssql');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- SQL Server connection ---
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.SA_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    trustServerCertificate: true
  }
};

let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// --- Multer config for image uploads (unchanged) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// HSC Standard 2 topics
const TOPICS = [
  'Algebra',
  'Measurement',
  'Financial Mathematics',
  'Statistical Analysis',
  'Networks',
  'Probability',
  'Linear Relationships',
  'Non-linear Relationships',
  'Trigonometry',
  'Simultaneous Linear Equations'
];

// --- Routes ---

// GET all topics
app.get('/api/topics', (req, res) => {
  res.json(TOPICS);
});

// GET all questions (optionally filter by topic)
app.get('/api/questions', async (req, res) => {
  try {
    const { topic } = req.query;
    const db = await getPool();
    let query = 'SELECT * FROM questions ORDER BY created_at DESC';
    
    if (topic && topic !== 'all') {
      query = 'SELECT * FROM questions WHERE topic = @topic ORDER BY created_at DESC';
      const result = await db.request()
        .input('topic', sql.NVarChar, topic)
        .query(query);
      return res.json(result.recordset);
    }

    const result = await db.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET random question (optionally by topic)
app.get('/api/questions/random', async (req, res) => {
  try {
    const { topic } = req.query;
    const db = await getPool();
    let query = 'SELECT TOP 1 * FROM questions ORDER BY NEWID()';

    if (topic && topic !== 'all') {
      query = 'SELECT TOP 1 * FROM questions WHERE topic = @topic ORDER BY NEWID()';
      const result = await db.request()
        .input('topic', sql.NVarChar, topic)
        .query(query);
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'No questions found for this topic' });
      }
      return res.json(result.recordset[0]);
    }

    const result = await db.request().query(query);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No questions found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST upload new question
app.post('/api/questions', upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { topic, source, marks } = req.body;

    if (!req.files?.question_image) {
      return res.status(400).json({ error: 'Question image is required' });
    }
    if (!topic || !TOPICS.includes(topic)) {
      return res.status(400).json({ error: 'Valid topic is required' });
    }

    const question_image = `/uploads/${req.files.question_image[0].filename}`;
    const answer_image = req.files?.answer_image
      ? `/uploads/${req.files.answer_image[0].filename}`
      : null;

    const db = await getPool();
    const result = await db.request()
      .input('topic', sql.NVarChar, topic)
      .input('source', sql.NVarChar, source || '')
      .input('marks', sql.Int, marks ? parseInt(marks) : null)
      .input('question_image', sql.NVarChar, question_image)
      .input('answer_image', sql.NVarChar, answer_image)
      .query(`
        INSERT INTO questions (topic, source, marks, question_image, answer_image)
        OUTPUT INSERTED.*
        VALUES (@topic, @source, @marks, @question_image, @answer_image)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET single question by ID
app.get('/api/questions/:id', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM questions WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE a question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const db = await getPool();

    // First get the question so we can delete the image files
    const found = await db.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM questions WHERE id = @id');

    if (found.recordset.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const q = found.recordset[0];

    // Delete image files from disk
    [q.question_image, q.answer_image].forEach(imgPath => {
      if (imgPath) {
        const fullPath = path.join(__dirname, imgPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    });

    // Delete from database
    await db.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM questions WHERE id = @id');

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST save a result when student marks themselves
app.post('/api/results', async (req, res) => {
  try {
    const { question_id, topic, correct } = req.body;
    if (!question_id || !topic || correct === undefined) {
      return res.status(400).json({ error: 'question_id, topic and correct are required' });
    }

    const db = await getPool();
    await db.request()
      .input('question_id', sql.Int, question_id)
      .input('topic', sql.NVarChar, topic)
      .input('correct', sql.Bit, correct ? 1 : 0)
      .query(`
        INSERT INTO results (question_id, topic, correct)
        VALUES (@question_id, @topic, @correct)
      `);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET progress stats per topic
app.get('/api/progress', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(`
      SELECT 
        topic,
        COUNT(*) as total,
        SUM(CAST(correct AS INT)) as correct,
        COUNT(*) - SUM(CAST(correct AS INT)) as incorrect,
        ROUND(100.0 * SUM(CAST(correct AS INT)) / COUNT(*), 1) as percentage
      FROM results
      GROUP BY topic
      ORDER BY percentage ASC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET all results
app.get('/api/results', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(`
      SELECT 
        r.id,
        r.question_id,
        r.topic,
        r.correct,
        r.answered_at,
        q.source
      FROM results r
      JOIN questions q ON r.question_id = q.id
      ORDER BY r.answered_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => console.log(`HSC Maths API running on http://localhost:${PORT}`));
