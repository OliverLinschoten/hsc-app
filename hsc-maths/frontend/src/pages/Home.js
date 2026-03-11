import { useState, useEffect } from 'react';
import './Home.css';

const API = 'http://localhost:3001';

export default function Home({ onStart }) {
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState('all');
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/topics`).then(r => r.json()),
      fetch(`${API}/api/questions`).then(r => r.json())
    ]).then(([topicList, questions]) => {
      setTopics(topicList);
      const c = { all: questions.length };
      topicList.forEach(t => {
        c[t] = questions.filter(q => q.topic === t).length;
      });
      setCounts(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalForSelected = counts[selected] || 0;

  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-hero-label">Standard 2 Mathematics</div>
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

      <div className="home-cta">
        {totalForSelected === 0 && !loading ? (
          <div className="no-questions">
            No questions yet for this topic.<br />
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

      <div className="home-grid-bg" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="grid-cell" />
        ))}
      </div>
    </div>
  );
}
