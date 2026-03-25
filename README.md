# HSC Maths Practice

A web app for practicing HSC Mathematics exam questions across all five HSC courses. Students work through real screenshots from past papers and trial exams, self-marking at their own pace. Built for deployment at [hscm.au](https://hscm.au).

## Stack

- **Frontend:** React, hosted on Vercel (`hsc-app-seven.vercel.app`)
- **Backend:** Node.js + Express, hosted on Render (`hscm-api.onrender.com`)
- **Database:** PostgreSQL via Supabase (pooled connection, port 6543)
- **Image storage:** Cloudinary (multer memory storage, buffer streaming)
- **Auth:** JWT (jsonwebtoken v9) + bcrypt, role-based access (student / admin)

## Setup

### Backend

```bash
cd backend
npm install
```

Create a `.env` file with:

```
PORT=5000
DATABASE_URL=your_supabase_pooled_connection_string
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

```bash
node server.js
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend expects the backend API at the URL configured in `src/api.js`.

## Features

### Multi-course support

Five HSC Mathematics courses, each with their own topic lists:

- **Standard 1** — Algebra, Measurement, Financial Mathematics, Statistical Analysis, Networks
- **Standard 2** — Algebra, Measurement, Financial Mathematics, Statistical Analysis, Networks, Probability, Linear Relationships, Non-linear Relationships, Trigonometry, Simultaneous Linear Equations
- **Advanced** — Functions, Trigonometric Functions, Calculus, Exponential & Logarithmic Functions, Statistical Analysis
- **Extension 1** — Functions, Trigonometric Functions, Calculus, Combinatorics, Proof, Vectors
- **Extension 2** — Proof, Vectors, Complex Numbers, Calculus, Mechanics

Course selection persists across pages via state in `App.js`.

### Practice mode

- Select a course, then pick one or more topics (multi-select supported)
- Question counts sum across selected topics
- Random questions served from the selected pool
- Self-mark each question with **✓ Got it** / **✗ Missed it**
- Scratchpad overlay on every question image — draw, erase, undo (Ctrl+Z), pick colours, clear
- Supports Apple Pencil / stylus eraser button detection

### Papers mode

- Work through a full exam paper in sequential order
- Numbered navigation pills with answered-status indicators
- Prev / Next arrows for paper navigation
- **Finish Paper** button on the last question

### Results

- All-time performance overview: total attempts, incorrect count, accuracy percentage
- Accuracy breakdown by topic with bar chart
- Filterable/sortable history table (correct, incorrect, all)
- Paginated results with click-through to review individual questions

### Admin panel (admin role only)

- Upload question and optional answer screenshots (stored in Cloudinary)
- Tag each question with topic, course, paper name, question number, and marks
- Edit and delete existing questions
- View student list with per-student accuracy stats

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Get current user (requires auth)

### Courses & Topics
- `GET /api/courses` — List all courses with their topics
- `GET /api/topics?course=` — Get topics for a course

### Papers
- `GET /api/papers?course=` — List papers with question counts and total marks

### Questions
- `GET /api/questions?topic=&course=` — List questions (supports comma-separated topics)
- `GET /api/questions/random?topic=&course=` — Get a random question
- `GET /api/questions/paper/:paper` — Get all questions for a paper in order
- `POST /api/questions` — Upload a new question (admin, multipart)
- `PUT /api/questions/:id` — Update a question (admin, multipart)
- `DELETE /api/questions/:id` — Delete a question (admin)

### Results & Progress
- `POST /api/results` — Record a result
- `GET /api/results` — Get user's result history
- `GET /api/progress` — Get user's accuracy by topic

### Admin
- `GET /api/admin/students` — List all students with stats (admin)

## File Structure

```
backend/
  server.js           # Express API (all routes, auth middleware, Cloudinary helpers)
  package.json

frontend/
  src/
    App.js            # Main app — navigation, course state, page routing
    AuthContext.js     # Auth context provider (JWT storage, login/logout)
    api.js            # authFetch helper (attaches JWT to requests)
    index.js          # React entry point
    pages/
      Auth.js         # Login / register page
      Home.js         # Course & topic selector, start practice
      Practice.js     # Question display, self-marking, paper navigation
      Papers.js       # Paper list by course
      Results.js      # Performance stats, history table
      Admin.js        # Question upload/edit/delete, student list
    components/
      Scratchpad.js   # Canvas overlay for drawing on questions
```

## Database Schema (Supabase / PostgreSQL)

**users** — id, email, password_hash, role (default 'student'), created_at

**questions** — id, topic, paper, marks, question_number, course, question_image, answer_image, created_at

**results** — id, user_id → users, question_id → questions, topic, correct, answered_at