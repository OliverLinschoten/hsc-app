import { useState } from 'react';
import Home from './pages/Home';
import Practice from './pages/Practice';
import Admin from './pages/Admin';
import Results from './pages/Results';
import Auth from './pages/Auth';
import { useAuth } from './AuthContext';
import './App.css';

export default function App() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState('home');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  const navigate = (p, opts = {}) => {
    if (opts.topic) setSelectedTopic(opts.topic);
    if (opts.questionId !== undefined) setSelectedQuestionId(opts.questionId);
    setPage(p);
  };

  // Not logged in — show auth page
  if (!user) return < Auth />;

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo" onClick={() => navigate('home')}>
          <span className="nav-logo-main">HSC</span>
          <span className="nav-logo-sub">MATHS_02</span>
        </div>
        <div className="nav-links">
          <button className={`nav-link ${page === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>
            Practice
          </button>
          <button className={`nav-link ${page === 'results' ? 'active' : ''}`} onClick={() => navigate('results')}>
            Results
          </button>
          {user.role === 'admin' && (
            <button className={`nav-link ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}>
              Admin
            </button>
          )}
          <button className="nav-link nav-link--logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="main">
        {page === 'home' && <Home onStart={(topic) => navigate('practice', { topic })} />}
        {page === 'practice' && (
          <Practice
            topic={selectedTopic}
            id={selectedQuestionId}
            onBack={() => navigate('home')}
            onNext={() => setSelectedQuestionId(null)}
          />
        )}
        {page === 'results' && (
          <Results
            onViewQuestion={(id, topic) => navigate('practice', { questionId: id, topic })}
          />
        )}
        {page === 'admin' && user.role === 'admin' && <Admin />}
      </main>
    </div>
  );
}