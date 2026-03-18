import { useState, useEffect } from 'react';
import './Home.css';
import { authFetch } from '../api';

export default function Home({ course, onCourseChange, onStart }) {
  const [courses, setCourses] = useState({});
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState('all');
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch available courses on mount
  useEffect(() => {
    authFetch('/api/courses').then(r => r.json()).then(setCourses);
  }, []);

  // When course changes, fetch topics + questions for that course
  useEffect(() => {
    if (!course) {
      setTopics([]);
      setCounts({});
      return;
    }

    setLoading(true);
    setSelected('all');

    Promise.all([
      authFetch(`/api/topics?course=${encodeURIComponent(course)}`).then(r => r.json()),
      authFetch(`/api/questions?course=${encodeURIComponent(course)}`).then(r => r.json())
    ]).then(([topicList, questions]) => {
      setTopics(topicList);
      const c = { all: questions.length };
      topicList.forEach(t => {
        c[t] = questions.filter(q => q.topic === t).length;
      });
      setCounts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course]);

  const totalForSelected = counts[selected] || 0;

  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-hero-label">
          {course ? `${course} Mathematics` : 'HSC Mathematics'}
        </div>
        <h1 className="home-title">
          Practise.<br />
          <span className="home-title-accent">Improve.</span><br />
          Excel.
        </h1>
        <p className="home-sub">
          Real questions from past HSC &amp; trial papers.<br />
          Self-mark at your own pace.
        </p>
      </div>

      {/* Course selector */}
      <div className="home-selector">
        <div className="selector-label">// SELECT COURSE</div>
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

      {/* Topic selector — only shows after course is picked */}
      {course && (
        <div className="home-selector">
          <div className="selector-label">// SELECT TOPIC</div>
          <div className="topic-grid">
            <button
              className={`topic-btn ${selected === 'all' ? 'active' : ''}`}
              onClick={() => setSelected('all')}
            >
              <span className="topic-name">All Topics</span>
              <span className="topic-count">{loading ? '…' : counts.all || 0}</span>
            </button>
            {topics.map(topic => (
              <button
                key={topic}
                className={`topic-btn ${selected === topic ? 'active' : ''}`}
                onClick={() => setSelected(topic)}
              >
                <span className="topic-name">{topic}</span>
                <span className="topic-count">{loading ? '…' : counts[topic] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {course && (
        <div className="home-cta">
          {totalForSelected === 0 && !loading ? (
            <div className="no-questions">
              No questions yet for this selection.<br />
              <span>Add some via the Admin panel.</span>
            </div>
          ) : (
            <button
              className="start-btn"
              onClick={() => onStart(selected)}
              disabled={totalForSelected === 0}
            >
              <span className="start-btn-label">Start Practice</span>
              <span className="start-btn-arrow">→</span>
            </button>
          )}
        </div>
      )}

      <div className="home-grid-bg" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="grid-cell" />
        ))}
      </div>
    </div>
  );
}