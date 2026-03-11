import { useState } from 'react';
import Home from './pages/Home';
import Practice from './pages/Practice';
import Admin from './pages/Admin';
import './App.css';

export default function App() {
  const [page, setPage] = useState('home');
  const [selectedTopic, setSelectedTopic] = useState('all');

  const navigate = (p, opts = {}) => {
    if (opts.topic) setSelectedTopic(opts.topic);
    setPage(p);
  };

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
          <button className={`nav-link ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}>
            Admin
          </button>
        </div>
      </nav>

      <main className="main">
        {page === 'home' && <Home onStart={(topic) => navigate('practice', { topic })} />}
        {page === 'practice' && <Practice topic={selectedTopic} onBack={() => navigate('home')} />}
        {page === 'admin' && <Admin />}
      </main>
    </div>
  );
}
