import { useState, useEffect, useRef } from 'react';
import './Admin.css';
import { authFetch } from '../api';

export default function Admin() {
  const [courses, setCourses] = useState({});
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [filterTopic, setFilterTopic] = useState('all');

  const [form, setForm] = useState({
    course: '',
    topic: '',
    paper: '',
    marks: '',
    question_number: '',
    question_image: null,
    answer_image: null
  });
  const [previewQ, setPreviewQ] = useState(null);
  const [previewA, setPreviewA] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editPreviewQ, setEditPreviewQ] = useState(null);
  const [editPreviewA, setEditPreviewA] = useState(null);
  const [saving, setSaving] = useState(false);

  // View state
  const [viewingId, setViewingId] = useState(null);

  const qRef = useRef();
  const aRef = useRef();
  const editQRef = useRef();
  const editARef = useRef();

  useEffect(() => {
    authFetch('/api/courses').then(r => r.json()).then(setCourses);
    loadQuestions();
  }, []);

  const availableTopics = form.course && courses[form.course] ? courses[form.course] : [];
  const allTopics = [...new Set(Object.values(courses).flat())];

  async function loadQuestions() {
    setLoading(true);
    const res = await authFetch('/api/questions');
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

  function handleEditFile(field, file) {
    if (!file) return;
    setEditForm(f => ({ ...f, [field]: file }));
    const reader = new FileReader();
    reader.onload = (e) => {
      if (field === 'question_image') setEditPreviewQ(e.target.result);
      else setEditPreviewA(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.course || !form.topic || !form.question_image || !form.marks || !form.question_number || !form.answer_image) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }
    setUploading(true);
    setMessage(null);

    const fd = new FormData();
    fd.append('course', form.course);
    fd.append('topic', form.topic);
    fd.append('paper', form.paper);
    fd.append('marks', form.marks);
    fd.append('question_number', form.question_number);
    fd.append('question_image', form.question_image);
    if (form.answer_image) fd.append('answer_image', form.answer_image);

    try {
      const res = await authFetch('/api/questions', { method: 'POST', body: fd, headers: {} });
      if (!res.ok) throw new Error('Upload failed');
      setMessage({ type: 'success', text: 'Question uploaded successfully!' });
      setForm({ course: form.course, topic: '', paper: form.paper, marks: '', question_number: '', question_image: null, answer_image: null });
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

  function startEdit(q) {
    setEditingId(q.id);
    setViewingId(null);
    setEditForm({
      course: q.course || '',
      topic: q.topic || '',
      paper: q.paper || '',
      marks: q.marks || '',
      question_number: q.question_number || '',
      question_image: null,
      answer_image: null
    });
    setEditPreviewQ(null);
    setEditPreviewA(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditPreviewQ(null);
    setEditPreviewA(null);
    if (editQRef.current) editQRef.current.value = '';
    if (editARef.current) editARef.current.value = '';
  }

  async function handleSaveEdit() {
    setSaving(true);
    const fd = new FormData();
    fd.append('course', editForm.course);
    fd.append('topic', editForm.topic);
    fd.append('paper', editForm.paper);
    fd.append('marks', editForm.marks);
    fd.append('question_number', editForm.question_number);
    if (editForm.question_image) fd.append('question_image', editForm.question_image);
    if (editForm.answer_image) fd.append('answer_image', editForm.answer_image);

    try {
      const res = await authFetch(`/api/questions/${editingId}`, { method: 'PUT', body: fd, headers: {} });
      if (!res.ok) throw new Error('Update failed');
      cancelEdit();
      loadQuestions();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleView(id) {
    if (editingId === id) return;
    setViewingId(prev => prev === id ? null : id);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this question?')) return;
    await authFetch(`/api/questions/${id}`, { method: 'DELETE' });
    if (editingId === id) cancelEdit();
    if (viewingId === id) setViewingId(null);
    loadQuestions();
  }

  const editTopics = editForm.course && courses[editForm.course] ? courses[editForm.course] : [];

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
            <label>Course *</label>
            <select
              value={form.course}
              onChange={e => setForm(f => ({ ...f, course: e.target.value, topic: '' }))}
            >
              <option value="">Select course…</option>
              {Object.keys(courses).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Topic *</label>
            <select
              value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              disabled={!form.course}
            >
              <option value="">{form.course ? 'Select topic…' : 'Pick a course first'}</option>
              {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Paper</label>
              <input
                type="text"
                placeholder="e.g. 2023 HSC Paper"
                value={form.paper}
                onChange={e => setForm(f => ({ ...f, paper: e.target.value }))}
              />
            </div>
            <div className="form-group form-group-sm">
              <label>Q #</label>
              <input
                type="number"
                placeholder="e.g. 1"
                min="1"
                max="50"
                value={form.question_number}
                onChange={e => setForm(f => ({ ...f, question_number: e.target.value }))}
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
            <label>Answer Image *</label>
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
              {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="filter-count">{filtered.length} shown</span>
          </div>

          {loading ? (
            <div className="list-loading">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="list-empty">No questions yet. Upload one to get started.</div>
          ) : (
            <div className="question-list">
              {filtered.map(q => {
                const isViewing = viewingId === q.id;
                const isEditing = editingId === q.id;
                const isExpanded = isViewing || isEditing;

                return (
                  <div key={q.id}>
                    <div className={`question-row ${isExpanded ? 'expanded' : ''} ${isEditing ? 'editing' : ''}`}>
                      <img
                        src={q.question_image}
                        alt="Q"
                        className="row-thumb"
                        onClick={() => toggleView(q.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="row-info">
                        {q.course && <span className="row-course">{q.course}</span>}
                        <span className="row-topic">{q.topic}</span>
                        {q.paper && <span className="row-source">{q.paper}</span>}
                        {q.question_number && <span className="row-qnum">Q{q.question_number}</span>}
                        {q.marks && <span className="row-marks">{q.marks}m</span>}
                        {q.answer_image && <span className="row-has-answer">✓ ans</span>}
                      </div>
                      <button
                        className={`view-btn ${isViewing ? 'active' : ''}`}
                        onClick={() => toggleView(q.id)}
                        title={isViewing ? 'Hide images' : 'View images'}
                      >
                        {isViewing ? '▾' : '▸'}
                      </button>
                      <button
                        className="edit-btn"
                        onClick={() => isEditing ? cancelEdit() : startEdit(q)}
                        title={isEditing ? 'Cancel edit' : 'Edit question'}
                      >
                        {isEditing ? '✕' : '✎'}
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(q.id)}>🗑</button>
                    </div>

                    {/* View panel — show images */}
                    {isViewing && !isEditing && (
                      <div className="view-panel">
                        <div className="view-image-group">
                          <div className="view-image-label">Question</div>
                          <img src={q.question_image} alt="Question" className="view-image" />
                        </div>
                        {q.answer_image && (
                          <div className="view-image-group">
                            <div className="view-image-label">Answer</div>
                            <img src={q.answer_image} alt="Answer" className="view-image" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="edit-panel">
                        <div className="form-group">
                          <label>Course</label>
                          <select
                            value={editForm.course}
                            onChange={e => setEditForm(f => ({ ...f, course: e.target.value, topic: '' }))}
                          >
                            <option value="">Select course…</option>
                            {Object.keys(courses).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Topic</label>
                          <select
                            value={editForm.topic}
                            onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                            disabled={!editForm.course}
                          >
                            <option value="">Select topic…</option>
                            {editTopics.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Paper</label>
                            <input
                              type="text"
                              value={editForm.paper}
                              onChange={e => setEditForm(f => ({ ...f, paper: e.target.value }))}
                            />
                          </div>
                          <div className="form-group form-group-sm">
                            <label>Q #</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={editForm.question_number}
                              onChange={e => setEditForm(f => ({ ...f, question_number: e.target.value }))}
                            />
                          </div>
                          <div className="form-group form-group-sm">
                            <label>Marks</label>
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={editForm.marks}
                              onChange={e => setEditForm(f => ({ ...f, marks: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="edit-images">
                          <div className="form-group">
                            <label>Replace Question Image</label>
                            <div
                              className={`drop-zone drop-zone-sm ${editPreviewQ ? 'has-preview' : ''}`}
                              onClick={() => editQRef.current?.click()}
                            >
                              {editPreviewQ ? (
                                <img src={editPreviewQ} alt="Preview" className="drop-preview" />
                              ) : (
                                <div className="drop-placeholder">
                                  <span className="drop-icon-sm">↑</span>
                                  <span>Click to replace</span>
                                </div>
                              )}
                            </div>
                            <input ref={editQRef} type="file" accept="image/*" hidden onChange={e => handleEditFile('question_image', e.target.files[0])} />
                          </div>

                          <div className="form-group">
                            <label>Replace Answer Image</label>
                            <div
                              className={`drop-zone drop-zone-sm ${editPreviewA ? 'has-preview' : ''}`}
                              onClick={() => editARef.current?.click()}
                            >
                              {editPreviewA ? (
                                <img src={editPreviewA} alt="Preview" className="drop-preview" />
                              ) : (
                                <div className="drop-placeholder">
                                  <span className="drop-icon-sm">↑</span>
                                  <span>Click to replace</span>
                                </div>
                              )}
                            </div>
                            <input ref={editARef} type="file" accept="image/*" hidden onChange={e => handleEditFile('answer_image', e.target.files[0])} />
                          </div>
                        </div>

                        <div className="edit-actions">
                          <button className="save-edit-btn" onClick={handleSaveEdit} disabled={saving}>
                            {saving ? 'Saving…' : '✓ Save Changes'}
                          </button>
                          <button className="cancel-edit-btn" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}