const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Data persistence (simple JSON file) ---
const DB_PATH = path.join(__dirname, 'questions.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) return { questions: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- Multer config for image uploads ---
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

// GET questions (optionally filter by topic)
app.get('/api/questions', (req, res) => {
  const { topic } = req.query;
  const db = readDB();
  let questions = db.questions;
  if (topic && topic !== 'all') {
    questions = questions.filter(q => q.topic === topic);
  }
  res.json(questions);
});

// GET random question (optionally by topic)
app.get('/api/questions/random', (req, res) => {
  const { topic } = req.query;
  const db = readDB();
  let questions = db.questions;
  if (topic && topic !== 'all') {
    questions = questions.filter(q => q.topic === topic);
  }
  if (questions.length === 0) {
    return res.status(404).json({ error: 'No questions found for this topic' });
  }
  const random = questions[Math.floor(Math.random() * questions.length)];
  res.json(random);
});

// POST upload new question
app.post('/api/questions', upload.fields([
  { name: 'question_image', maxCount: 1 },
  { name: 'answer_image', maxCount: 1 }
]), (req, res) => {
  const { topic, source, marks } = req.body;
  if (!req.files?.question_image) {
    return res.status(400).json({ error: 'Question image is required' });
  }
  if (!topic || !TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Valid topic is required' });
  }

  const question = {
    id: uuidv4(),
    topic,
    source: source || '',
    marks: marks ? parseInt(marks) : null,
    question_image: `/uploads/${req.files.question_image[0].filename}`,
    answer_image: req.files?.answer_image ? `/uploads/${req.files.answer_image[0].filename}` : null,
    created_at: new Date().toISOString()
  };

  const db = readDB();
  db.questions.push(question);
  writeDB(db);
  res.status(201).json(question);
});

// DELETE a question
app.delete('/api/questions/:id', (req, res) => {
  const db = readDB();
  const q = db.questions.find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });

  // Remove image files
  [q.question_image, q.answer_image].forEach(imgPath => {
    if (imgPath) {
      const fullPath = path.join(__dirname, imgPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
  });

  db.questions = db.questions.filter(q => q.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`HSC Maths API running on http://localhost:${PORT}`));
