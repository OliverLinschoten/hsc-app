import { useState, useEffect, useRef } from 'react';
import './Admin.css';

const API = 'http://localhost:3001';

export default function Admin() {
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [filterTopic, setFilterTopic] = useState('all');

  const [form, setForm] = useState({
    topic: '',
    source: '',
    marks: '',
    question_image: null,
    answer_image: null
  });
  const [previewQ, setPreviewQ] = useState(null);
  const [previewA, setPreviewA] = useState(null);

  const qRef = useRef();
  const aRef = useRef();

  useEffect(() => {
    fetch(`${API}/api/topics`).then(r => r.json()).then(setTopics);
    loadQuestions();
  }, []);

  async function loadQuestions() {
    setLoading(true);
    const res = await fetch(`${API}/api/questions`);
    const data = await res.json();
    setQuestions(data);
    setLoading(false);
  }

  function handleFile(field, file) {
    if (!file) return;
    setForm(f => ({ ...f, [field]: file }));
    const reader = new FileReader();
    reader.onload = (e) => {
      if (field === 'question_image') setPreviewQ(e.target.result);
      else setPreviewA(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.topic || !form.question_image) {
      setMessage({ type: 'error', text: 'Topic and question image are required.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append('topic', form.topic);
    fd.append('source', form.source);
    fd.append('marks', form.marks);
    fd.append('question_image', form.question_image);
    if (form.answer_image) fd.append('answer_image', form.answer_image);

    try {
      const res = await fetch(`${API}/api/questions`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      setMessage({ type: 'success', text: 'Question uploaded successfully!' });
      setForm({ topic: '', source: '', marks: '', question_image: null, answer_image: null });
      setPreviewQ(null);
      setPreviewA(null);
      if (qRef.current) qRef.current.value = '';
      if (aRef.current) aRef.current.value = '';
      loadQuestions();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this question?')) return;
    await fetch(`${API}/api/questions/${id}`, { method: 'DELETE' });
    loadQuestions();
  }

  const filtered = filterTopic === 'all' ? questions : questions.filter(q => q.topic === filterTopic);

  return (
    <div className="admin">
      <div className="admin-header">
        <div className="admin-title-label">// ADMIN PANEL</div>
        <h2 className="admin-title">Question Manager</h2>
        <p className="admin-sub">{questions.length} questions in database</p>
      </div>

      <div className="admin-grid">
        {/* Upload form */}
        <div className="admin-card">
          <div className="card-label">// UPLOAD NEW QUESTION</div>

          <div className="form-group">
            <label>Topic *</label>
            <select
              value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
            >
              <option value="">Select topic…</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Source</label>
              <input
                type="text"
                placeholder="e.g. 2023 HSC Paper"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className="form-group form-group-sm">
              <label>Marks</label>
              <input
                type="number"
                placeholder="e.g. 3"
                min="1"
                max="15"
                value={form.marks}
                onChange={e => setForm(f => ({ ...f, marks: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Question Image *</label>
            <div
              className={`drop-zone ${previewQ ? 'has-preview' : ''}`}
              onClick={() => qRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile('question_image', e.dataTransfer.files[0]); }}
            >
              {previewQ ? (
                <img src={previewQ} alt="Preview" className="drop-preview" />
              ) : (
                <div className="drop-placeholder">
                  <span className="drop-icon">↑</span>
                  <span>Click or drag screenshot here</span>
                </div>
              )}
            </div>
            <input ref={qRef} type="file" accept="image/*" hidden onChange={e => handleFile('question_image', e.target.files[0])} />
          </div>

          <div className="form-group">
            <label>Answer Image <span className="optional">(optional)</span></label>
            <div
              className={`drop-zone ${previewA ? 'has-preview' : ''}`}
              onClick={() => aRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile('answer_image', e.dataTransfer.files[0]); }}
            >
              {previewA ? (
                <img src={previewA} alt="Preview" className="drop-preview" />
              ) : (
                <div className="drop-placeholder">
                  <span className="drop-icon">↑</span>
                  <span>Click or drag answer screenshot</span>
                </div>
              )}
            </div>
            <input ref={aRef} type="file" accept="image/*" hidden onChange={e => handleFile('answer_image', e.target.files[0])} />
          </div>

          {message && (
            <div className={`form-message ${message.type}`}>{message.text}</div>
          )}

          <button className="upload-btn" onClick={handleSubmit} disabled={uploading}>
            {uploading ? 'Uploading…' : '↑ Upload Question'}
          </button>
        </div>

        {/* Questions list */}
        <div className="admin-card">
          <div className="card-label">// EXISTING QUESTIONS</div>

          <div className="filter-row">
            <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
              <option value="all">All Topics</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="filter-count">{filtered.length} shown</span>
          </div>

          {loading ? (
            <div className="list-loading">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="list-empty">No questions yet. Upload one to get started.</div>
          ) : (
            <div className="question-list">
              {filtered.map(q => (
                <div key={q.id} className="question-row">
                  <img
                    src={`${API}${q.question_image}`}
                    alt="Q"
                    className="row-thumb"
                  />
                  <div className="row-info">
                    <span className="row-topic">{q.topic}</span>
                    {q.source && <span className="row-source">{q.source}</span>}
                    {q.marks && <span className="row-marks">{q.marks}m</span>}
                    {q.answer_image && <span className="row-has-answer">✓ ans</span>}
                  </div>
                  <button className="delete-btn" onClick={() => handleDelete(q.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
