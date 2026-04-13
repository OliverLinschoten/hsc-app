require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
const COURSES = require('./constants/courses');
const pool = require('./config/db');

app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '10mb' }));

// API ROUTES
app.use('/api/questions', require('./routes/questions'));
app.use('/api/papers', require('./routes/papers'));
app.use('/api/results', require('./routes/results'));
app.use('/api/auth', require('./routes/auth'));

// SMALL UTILITY ROUTES
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


// SERVER SETUP
app.listen(PORT, () => {
  console.log(`HSC Maths API running on port ${PORT}`);
  console.log(`Using PostgreSQL via ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'manual config'}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});