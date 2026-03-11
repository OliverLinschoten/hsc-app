# HSC Maths Practice

A web app for HSC Standard 2 Maths practice using real screenshots from past papers and trial exams.

## Stack
- **Backend**: Node.js + Express (REST API + image uploads)
- **Frontend**: React
- **Storage**: JSON file + local image uploads (easy to migrate to a DB later)

## Setup

### 1. Backend
```bash
cd backend
npm install
node server.js
# Runs on http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

## Usage

### For Students
1. Open http://localhost:3000
2. Select a topic (or "All Topics")
3. Click **Start Practice**
4. View the question, self-mark using ✓ Got it / ✗ Missed it
5. Click **Next Question** to continue

### For Admins
1. Navigate to the **Admin** tab
2. Upload a question screenshot + optional answer screenshot
3. Tag it with a topic and source (e.g. "2023 HSC Paper")
4. Add marks (optional)
5. It's immediately available for practice!

## Topics (HSC Standard 2)
- Algebra
- Measurement
- Financial Mathematics
- Statistical Analysis
- Networks
- Probability
- Linear Relationships
- Non-linear Relationships
- Trigonometry
- Simultaneous Linear Equations

## File Structure
```
backend/
  server.js          # Express API
  questions.json     # Auto-created database
  uploads/           # Uploaded images

frontend/
  src/
    App.js           # Main app with navigation
    pages/
      Home.js        # Topic selector + start button
      Practice.js    # Question display + self-marking
      Admin.js       # Upload & manage questions
```

## Roadmap (future features)
- [ ] Topic filtering in practice mode
- [ ] Difficulty levels
- [ ] Progress tracking per student
- [ ] Spaced repetition (show weaker topics more)
- [ ] Deploy to Vercel (frontend) + Railway/Render (backend)
