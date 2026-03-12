import { useState, useEffect, useCallback } from 'react';
import './Practice.css';

const API = 'http://localhost:3001';

export default function Practice({ topic, id, onBack }) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'incorrect'
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, seen: 0 });
  const [imageZoomed, setImageZoomed] = useState(false);

const fetchQuestion = useCallback(async () => {
  setLoading(true);
  setError(null);
  setShowAnswer(false);
  setResult(null);
  setImageZoomed(false);

  try {
    let url;

    if (id) {
      // load specific question (reattempt)
      url = `${API}/api/questions/${id}`;
    } else if (topic && topic !== "all") {
      // random question by topic
      url = `${API}/api/questions/random?topic=${encodeURIComponent(topic)}`;
    } else {
      // random question
      url = `${API}/api/questions/random`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("No questions available");

    const data = await res.json();
    setQuestion(data);

  } catch (e) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}, [topic, id]);

  useEffect(() => { fetchQuestion(); }, [fetchQuestion]);

  const handleMark = async (correct) => {
    setResult(correct ? 'correct' : 'incorrect');
    setSessionStats(s => ({
      correct: s.correct + (correct ? 1 : 0),
      incorrect: s.incorrect + (correct ? 0 : 1),
      seen: s.seen + 1
    }));

    // Save result to database
    try {
      await fetch(`${API}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const topicLabel = topic === 'all' ? 'All Topics' : topic;

  return (
    <div className="practice">
      {/* Header bar */}
      <div className="practice-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="practice-topic-tag">{topicLabel}</div>
        <div className="session-stats">
          <span className="stat correct-stat">✓ {sessionStats.correct}</span>
          <span className="stat incorrect-stat">✗ {sessionStats.incorrect}</span>
          <span className="stat seen-stat"># {sessionStats.seen}</span>
        </div>
      </div>

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
              {question.source && <span className="q-source">{question.source}</span>}
              {question.marks && <span className="q-marks">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>}
            </div>

            <div className="question-label">// QUESTION</div>
            <div
              className={`question-image-wrap ${imageZoomed ? 'zoomed' : ''}`}
              onClick={() => setImageZoomed(z => !z)}
              title="Click to zoom"
            >
              <img
                src={`${API}${question.question_image}`}
                alt="Question"
                className="question-img"
              />
              <div className="zoom-hint">{imageZoomed ? '↙ click to shrink' : '↗ click to zoom'}</div>
            </div>

            {/* Self-mark section */}
            {!showAnswer && !result && (
              <div className="answer-reveal">
                {question.answer_image ? (
                  <button className="reveal-btn" onClick={() => setShowAnswer(true)}>
                    Reveal Answer
                  </button>
                ) : (
                  <div className="no-answer-note">No answer image uploaded for this question.</div>
                )}
                <div className="mark-prompt">Mark yourself:</div>
                <div className="mark-btns">
                  <button className="mark-btn correct" onClick={() => handleMark(true)}>
                    ✓ Got it
                  </button>
                  <button className="mark-btn incorrect" onClick={() => handleMark(false)}>
                    ✗ Missed it
                  </button>
                </div>
              </div>
            )}

            {showAnswer && question.answer_image && (
              <div className="answer-section">
                <div className="question-label">// ANSWER</div>
                <img
                  src={`${API}${question.answer_image}`}
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
                <button className="next-btn" onClick={fetchQuestion}>
                  Next Question →
                </button>
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
