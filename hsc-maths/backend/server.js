require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sql = require('mssql');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '10mb' }));

// --- Cloudinary config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// --- Multer memory storage ---
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- Cloudinary helpers ---
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

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}

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

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = await getPool();

    const existing = await db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM users WHERE email = @email');
    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.request()
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, password_hash)
      .query(`
        INSERT INTO users (email, password_hash)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
        VALUES (@email, @password_hash)
      `);

    const user = result.recordset[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await getPool();
    const result = await db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.recordset[0];
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

// GET current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, email, role, created_at FROM users WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Topic routes ──────────────────────────────────────────────────────────────

app.get('/api/topics', (req, res) => {
  res.json(TOPICS);
});

// ── Question routes ───────────────────────────────────────────────────────────

app.get('/api/questions', requireAuth, async (req, res) => {
  try {
    const { topic } = req.query;
    const db = await getPool();

    if (topic && topic !== 'all') {
      const result = await db.request()
        .input('topic', sql.NVarChar, topic)
        .query('SELECT * FROM questions WHERE topic = @topic ORDER BY created_at DESC');
      return res.json(result.recordset);
    }

    const result = await db.request().query('SELECT * FROM questions ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/questions/random', requireAuth, async (req, res) => {
  try {
    const { topic } = req.query;
    const db = await getPool();

    if (topic && topic !== 'all') {
      const result = await db.request()
        .input('topic', sql.NVarChar, topic)
        .query('SELECT TOP 1 * FROM questions WHERE topic = @topic ORDER BY NEWID()');
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'No questions found for this topic' });
      }
      return res.json(result.recordset[0]);
    }

    const result = await db.request().query('SELECT TOP 1 * FROM questions ORDER BY NEWID()');
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No questions found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/questions/:id', requireAuth, async (req, res) => {
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

app.post('/api/questions', requireAdmin, upload.fields([
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

    const question_image = await uploadToCloudinary(req.files.question_image[0].buffer);
    const answer_image = req.files?.answer_image
      ? await uploadToCloudinary(req.files.answer_image[0].buffer)
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

app.delete('/api/questions/:id', requireAdmin, async (req, res) => {
  try {
    const db = await getPool();

    const found = await db.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM questions WHERE id = @id');

    if (found.recordset.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const q = found.recordset[0];

    [q.question_image, q.answer_image].forEach(url => {
      if (url) cloudinary.uploader.destroy(getPublicId(url));
    });

    await db.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM questions WHERE id = @id');

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Results routes ────────────────────────────────────────────────────────────

app.post('/api/results', requireAuth, async (req, res) => {
  try {
    const { question_id, topic, correct } = req.body;
    if (!question_id || !topic || correct === undefined) {
      return res.status(400).json({ error: 'question_id, topic and correct are required' });
    }

    const db = await getPool();
    await db.request()
      .input('user_id', sql.Int, req.user.id)
      .input('question_id', sql.Int, question_id)
      .input('topic', sql.NVarChar, topic)
      .input('correct', sql.Bit, correct ? 1 : 0)
      .query(`
        INSERT INTO results (user_id, question_id, topic, correct)
        VALUES (@user_id, @question_id, @topic, @correct)
      `);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .input('user_id', sql.Int, req.user.id)
      .query(`
        SELECT 
          topic,
          COUNT(*) as total,
          SUM(CAST(correct AS INT)) as correct,
          COUNT(*) - SUM(CAST(correct AS INT)) as incorrect,
          ROUND(100.0 * SUM(CAST(correct AS INT)) / COUNT(*), 1) as percentage
        FROM results
        WHERE user_id = @user_id
        GROUP BY topic
        ORDER BY percentage ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/results', requireAuth, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .input('user_id', sql.Int, req.user.id)
      .query(`
        SELECT 
          r.id,
          r.question_id,
          r.topic,
          r.correct,
          r.answered_at,
          q.source
        FROM results r
        LEFT JOIN questions q ON r.question_id = q.id
        WHERE r.user_id = @user_id
        ORDER BY r.answered_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET all students + their stats
app.get('/api/admin/students', requireAdmin, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        COUNT(r.id) as total_attempts,
        SUM(CAST(r.correct AS INT)) as correct,
        CASE WHEN COUNT(r.id) > 0 
          THEN ROUND(100.0 * SUM(CAST(r.correct AS INT)) / COUNT(r.id), 1)
          ELSE 0 
        END as accuracy
      FROM users u
      LEFT JOIN results r ON u.id = r.user_id
      WHERE u.role = 'student'
      GROUP BY u.id, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => console.log(`HSC Maths API running on http://localhost:${PORT}`));