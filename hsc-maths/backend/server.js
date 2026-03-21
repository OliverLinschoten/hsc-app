require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '10mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary config
// ─────────────────────────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL connection pool (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multer memory storage
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary helpers
// ─────────────────────────────────────────────────────────────────────────────

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'hsc-maths' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

function getPublicId(url) {
  const parts = url.split('/');
  const file = parts[parts.length - 1].split('.')[0];
  return `hsc-maths/${file}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Courses & Topics
// ─────────────────────────────────────────────────────────────────────────────

const COURSES = {
  'Standard 1': [
    'Algebra', 'Measurement', 'Financial Mathematics',
    'Statistical Analysis', 'Networks'
  ],
  'Standard 2': [
    'Algebra', 'Measurement', 'Financial Mathematics',
    'Statistical Analysis', 'Networks', 'Probability',
    'Linear Relationships', 'Non-linear Relationships',
    'Trigonometry', 'Simultaneous Linear Equations'
  ],
  'Advanced': [
    'Functions', 'Trigonometric Functions', 'Calculus',
    'Exponential & Logarithmic Functions', 'Statistical Analysis'
  ],
  'Extension 1': [
    'Functions', 'Trigonometric Functions', 'Calculus',
    'Combinatorics', 'Proof', 'Vectors'
  ],
  'Extension 2': [
    'Proof', 'Vectors', 'Complex Numbers',
    'Calculus', 'Mechanics'
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, role`,
      [email, password_hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COURSE & TOPIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/courses', (req, res) => {
  res.json(COURSES);
});

app.get('/api/topics', (req, res) => {
  const { course } = req.query;
  if (course && COURSES[course]) {
    return res.json(COURSES[course]);
  }
  const all = [...new Set(Object.values(COURSES).flat())];
  res.json(all);
});

// ─────────────────────────────────────────────────────────────────────────────
// PAPER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/papers', requireAuth, async (req, res) => {
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

app.get('/api/questions/paper/:paper', requireAuth, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/questions', requireAuth, async (req, res) => {
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

app.get('/api/questions/random', requireAuth, async (req, res) => {
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

app.get('/api/questions/:id', requireAuth, async (req, res) => {
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

app.post('/api/questions', requireAdmin, upload.fields([
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

app.delete('/api/questions/:id', requireAdmin, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/results', requireAuth, async (req, res) => {
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

app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        topic,
        COUNT(*) as total,
        SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct,
        COUNT(*) - SUM(CASE WHEN correct THEN 1 ELSE 0 END) as incorrect,
        ROUND(100.0 * SUM(CASE WHEN correct THEN 1 ELSE 0 END) / COUNT(*), 1) as percentage
       FROM results
       WHERE user_id = $1
       GROUP BY topic
       ORDER BY percentage ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/results', requireAuth, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/students', requireAdmin, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// Server start
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`HSC Maths API running on port ${PORT}`);
  console.log(`Using PostgreSQL via ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'manual config'}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});