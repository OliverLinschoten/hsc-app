import { useState, useEffect } from 'react';
import './Papers.css';
import { authFetch } from '../api';

export default function Papers({ course, onCourseChange, onStartPaper }) {
  const [courses, setCourses] = useState({});
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available courses on mount
  useEffect(() => {
    authFetch('/api/courses').then(r => r.json()).then(setCourses);
  }, []);

  // Fetch papers when course changes
  useEffect(() => {
    if (!course) {
      setPapers([]);
      return;
    }

    setLoading(true);
    authFetch(`/api/papers?course=${encodeURIComponent(course)}`)
      .then(r => r.json())
      .then(data => {
        setPapers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [course]);

  return (
    <div className="papers">
      <div className="papers-hero">
        <div className="papers-hero-label">
          {course ? `${course} — Exam Practice` : 'Exam Practice'}
        </div>
        <h1 className="papers-title">
          Past<br />
          <span className="papers-title-accent">Papers.</span>
        </h1>
        <p className="papers-sub">
          Work through a full paper from start to finish.<br />
          Questions appear in exam order.
        </p>
      </div>

      {/* Course selector */}
      <div className="papers-course-selector">
        <div className="papers-section-label">// SELECT COURSE</div>
        <div className="topic-grid">
          {Object.keys(courses).map(c => (
            <button
              key={c}
              className={`topic-btn ${course === c ? 'active' : ''}`}
              onClick={() => onCourseChange(c)}
            >
              <span className="topic-name">{c}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Papers list — only shows after course is picked */}
      {course && (
        <div className="papers-list-section">
          <div className="papers-section-label">// AVAILABLE PAPERS</div>

          {loading ? (
            <div className="papers-loading">Loading papers…</div>
          ) : papers.length === 0 ? (
            <div className="papers-empty">
              No papers available for {course} yet.<br />
              <span>Questions need a paper name to appear here.</span>
            </div>
          ) : (
            <div className="papers-grid">
              {papers.map(p => (
                <button
                  key={p.paper}
                  className="paper-card"
                  onClick={() => onStartPaper(p.paper)}
                >
                  <div className="paper-card-name">{p.paper}</div>
                  <div className="paper-card-meta">
                    <span className="paper-card-count">
                      {p.question_count} question{p.question_count !== 1 ? 's' : ''}
                    </span>
                    {p.total_marks > 0 && (
                      <span className="paper-card-marks">
                        {p.total_marks} marks
                      </span>
                    )}
                  </div>
                  <div className="paper-card-arrow">→</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="papers-grid-bg" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="grid-cell" />
        ))}
      </div>
    </div>
  );
}