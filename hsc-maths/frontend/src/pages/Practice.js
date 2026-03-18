import { useState, useEffect, useCallback } from 'react';
import './Practice.css';
import { authFetch } from '../api';

export default function Practice({ topic, id, paper, course, onBack, onNext }) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, seen: 0 });
  const [imageZoomed, setImageZoomed] = useState(false);

  // Paper mode state
  const [paperQuestions, setPaperQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredMap, setAnsweredMap] = useState({});

  // Load paper questions on mount if in paper mode
  useEffect(() => {
    if (!paper) return;

    setLoading(true);
    authFetch(`/api/questions/paper/${encodeURIComponent(paper)}`)
      .then(r => r.json())
      .then(data => {
        setPaperQuestions(data);
        if (data.length > 0) {
          setQuestion(data[0]);
          setCurrentIndex(0);
        } else {
          setError('No questions found for this paper');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load paper');
        setLoading(false);
      });
  }, [paper]);

  // Fetch a single question (topic/random mode)
  const fetchQuestion = useCallback(async () => {
    if (paper) return;

    setLoading(true);
    setError(null);
    setShowAnswer(false);
    setResult(null);
    setImageZoomed(false);

    try {
      let url;
      const courseParam = course ? `course=${encodeURIComponent(course)}` : '';

      if (id) {
        url = `/api/questions/${id}`;
      } else if (topic && topic !== 'all') {
        url = `/api/questions/random?topic=${encodeURIComponent(topic)}${courseParam ? `&${courseParam}` : ''}`;
      } else {
        url = `/api/questions/random${courseParam ? `?${courseParam}` : ''}`;
      }

      const res = await authFetch(url);
      if (!res.ok) throw new Error('No questions available');

      const data = await res.json();
      setQuestion(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [topic, id, paper, course]);

  useEffect(() => {
    if (!paper) fetchQuestion();
  }, [fetchQuestion, paper]);

  const goToQuestion = (index) => {
    if (index < 0 || index >= paperQuestions.length) return;
    setCurrentIndex(index);
    setQuestion(paperQuestions[index]);
    setShowAnswer(false);
    setImageZoomed(false);
    const qId = paperQuestions[index].id;
    setResult(answeredMap[qId] || null);
  };

  const handleMark = async (correct) => {
    const status = correct ? 'correct' : 'incorrect';
    setResult(status);
    setSessionStats(s => ({
      correct: s.correct + (correct ? 1 : 0),
      incorrect: s.incorrect + (correct ? 0 : 1),
      seen: s.seen + 1
    }));

    if (paper && question) {
      setAnsweredMap(prev => ({ ...prev, [question.id]: status }));
    }

    try {
      await authFetch('/api/results', {
        method: 'POST',
        body: JSON.stringify({
          question_id: question.id,
          topic: question.topic,
          correct: correct
        })
      });
    } catch (err) {
      console.error('Failed to save result:', err);
    }
  };

  const handleNext = () => {
    if (paper) {
      if (currentIndex < paperQuestions.length - 1) {
        goToQuestion(currentIndex + 1);
      }
    } else {
      if (onNext) onNext();
      fetchQuestion();
    }
  };

  const handlePrev = () => {
    if (paper && currentIndex > 0) {
      goToQuestion(currentIndex - 1);
    }
  };

  const isPaperMode = !!paper;
  const topicLabel = isPaperMode ? paper : (topic === 'all' ? 'All Topics' : topic);
  const isLastQuestion = isPaperMode && currentIndex >= paperQuestions.length - 1;
  const isFirstQuestion = isPaperMode && currentIndex === 0;

  return (
    <div className="practice">
      <div className="practice-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="practice-topic-tag">{topicLabel}</div>
        {isPaperMode && paperQuestions.length > 0 && (
          <div className="paper-progress">
            Q{currentIndex + 1} / {paperQuestions.length}
          </div>
        )}
        <div className="session-stats">
          <span className="stat correct-stat">✓ {sessionStats.correct}</span>
          <span className="stat incorrect-stat">✗ {sessionStats.incorrect}</span>
          <span className="stat seen-stat"># {sessionStats.seen}</span>
        </div>
      </div>

      {/* Paper mode: question number pills with answered status */}
      {isPaperMode && paperQuestions.length > 0 && (
        <div className="paper-nav">
          {paperQuestions.map((q, i) => {
            const status = answeredMap[q.id] || '';
            return (
              <button
                key={q.id}
                className={`paper-nav-pill ${i === currentIndex ? 'active' : ''} ${status ? `pill-${status}` : ''}`}
                onClick={() => goToQuestion(i)}
                title={`Question ${q.question_number || i + 1}`}
              >
                Q{q.question_number || i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Paper mode: persistent prev/next navigation */}
      {isPaperMode && paperQuestions.length > 0 && !loading && (
        <div className="paper-nav-arrows">
          <button
            className="paper-arrow-btn"
            onClick={handlePrev}
            disabled={isFirstQuestion}
          >
            ← Prev
          </button>
          {isLastQuestion ? (
            <button className="paper-arrow-btn paper-arrow-finish" onClick={onBack}>
              Finish Paper ✓
            </button>
          ) : (
            <button
              className="paper-arrow-btn paper-arrow-next"
              onClick={handleNext}
            >
              Next →
            </button>
          )}
        </div>
      )}

      <div className="practice-body">
        {loading && (
          <div className="practice-loading">
            <div className="loading-dots">
              <span /><span /><span />
            </div>
            <p>Loading question…</p>
          </div>
        )}

        {error && !loading && (
          <div className="practice-error">
            <p>{error}</p>
            <button className="btn-outline" onClick={onBack}>Go back</button>
          </div>
        )}

        {question && !loading && (
          <div className="question-card">
            <div className="question-meta">
              <span className="q-topic">{question.topic}</span>
              {question.paper && <span className="q-source">{question.paper}</span>}
              {question.question_number && (
                <span className="q-number">Q{question.question_number}</span>
              )}
              {question.marks && <span className="q-marks">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>}
            </div>

            <div className="question-label">// QUESTION</div>
            <div
              className={`question-image-wrap ${imageZoomed ? 'zoomed' : ''}`}
              onClick={() => setImageZoomed(z => !z)}
              title="Click to zoom"
            >
              <img
                src={question.question_image}
                alt="Question"
                className="question-img"
              />
              <div className="zoom-hint">{imageZoomed ? '↙ click to shrink' : '↗ click to zoom'}</div>
            </div>

            {!showAnswer && !result && (
              <div className="answer-reveal">
                {question.answer_image ? (
                  <button className="reveal-btn" onClick={() => setShowAnswer(true)}>
                    Reveal Answer
                  </button>
                ) : (
                  <>
                    <div className="no-answer-note">No answer image uploaded for this question.</div>
                    <div className="mark-prompt">Mark yourself:</div>
                    <div className="mark-btns">
                      <button className="mark-btn correct" onClick={() => handleMark(true)}>
                        ✓ Got it
                      </button>
                      <button className="mark-btn incorrect" onClick={() => handleMark(false)}>
                        ✗ Missed it
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {showAnswer && question.answer_image && (
              <div className="answer-section">
                <div className="question-label">// ANSWER</div>
                <img
                  src={question.answer_image}
                  alt="Answer"
                  className="answer-img"
                />
                {!result && (
                  <div className="mark-btns">
                    <button className="mark-btn correct" onClick={() => handleMark(true)}>
                      ✓ Got it
                    </button>
                    <button className="mark-btn incorrect" onClick={() => handleMark(false)}>
                      ✗ Missed it
                    </button>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className={`result-banner ${result}`}>
                <span className="result-icon">{result === 'correct' ? '✓' : '✗'}</span>
                <span className="result-text">
                  {result === 'correct' ? 'Nice work!' : 'Keep practising!'}
                </span>
                {!isPaperMode && (
                  <button className="next-btn" onClick={handleNext}>
                    Next Question →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {imageZoomed && (
        <div className="zoom-overlay" onClick={() => setImageZoomed(false)} />
      )}
    </div>
  );
}