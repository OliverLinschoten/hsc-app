import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import "./ResultsPage.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

async function fetchResults() {
  const res = await fetch(`${API_BASE}/api/results`);
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

function computeTopicStats(results) {
  const map = {};
  for (const r of results) {
    if (!map[r.topic]) map[r.topic] = { topic: r.topic, correct: 0, total: 0 };
    map[r.topic].total++;
    if (r.correct) map[r.topic].correct++;
  }
  return Object.values(map).map((t) => ({
    ...t,
    accuracy: Math.round((t.correct / t.total) * 100),
    incorrect: t.total - t.correct,
  }));
}

const ACCENT = "var(--accent)";
const RED = "#f87171";
const GREEN = "#4ade80";
const YELLOW = "#facc15";

function barColor(accuracy) {
  if (accuracy >= 75) return GREEN;
  if (accuracy >= 50) return YELLOW;
  return RED;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TopicBar({ topic, accuracy, total }) {
  return (
    <div className="topic-bar-row">
      <div className="topic-bar-label">{topic}</div>
      <div className="topic-bar-track">
        <div
          className="topic-bar-fill"
          style={{ width: `${accuracy}%`, background: barColor(accuracy) }}
        />
      </div>
      <div className="topic-bar-pct" style={{ color: barColor(accuracy) }}>{accuracy}%</div>
      <div className="topic-bar-count">{total} attempts</div>
    </div>
  );
}

function RecommendationsPanel({ topicStats }) {
  const weak = [...topicStats]
    .filter((t) => t.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weak.length === 0) {
    return (
      <p className="rec-empty">
        🎉 No topics below 60% — keep it up.
      </p>
    );
  }

  return (
    <div>
      {weak.map((t) => (
        <div key={t.topic} className="rec-item">
          <div className="rec-item-left">
            <div className="rec-item-dot" style={{ background: barColor(t.accuracy) }} />
            <div>
              <div className="rec-item-topic">{t.topic}</div>
              <div className="rec-item-attempts">{t.correct}/{t.total} correct</div>
            </div>
          </div>
          <div className="rec-item-pct" style={{ color: barColor(t.accuracy) }}>
            {t.accuracy}%
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomTooltipBar({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-title">{d.topic}</div>
      <div>Correct: <span style={{ color: GREEN }}>{d.correct}</span></div>
      <div>Incorrect: <span style={{ color: RED }}>{d.incorrect}</span></div>
    </div>
  );
}

function CustomTooltipPie({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      {payload[0].name}: <strong style={{ color: payload[0].payload.color }}>{payload[0].value}</strong>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResultsPage({ onViewQuestion }) {
  const [results, setResults] = useState([]);
  const [topicStats, setTopicStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableFilter, setTableFilter] = useState("all");
  const [sortKey, setSortKey] = useState("answered_at");

  useEffect(() => {
    fetchResults()
      .then((data) => {
        setResults(data);
        setTopicStats(computeTopicStats(data));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const bestTopic = [...topicStats].sort((a, b) => b.accuracy - a.accuracy)[0];

  const filteredResults = results
    .filter((r) => {
      if (tableFilter === "correct") return r.correct;
      if (tableFilter === "incorrect") return !r.correct;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "answered_at") return new Date(b.answered_at) - new Date(a.answered_at);
      if (sortKey === "topic") return a.topic.localeCompare(b.topic);
      if (sortKey === "correct") return b.correct - a.correct;
      return 0;
    });

  const pieData = [
    { name: "Correct", value: correct, color: GREEN },
    { name: "Incorrect", value: total - correct, color: RED },
  ];

  return (
    <div className="results">

      {/* Hero */}
      <div className="results-hero">
        <div className="results-hero-label">Performance</div>
        <h1 className="results-title">
          Your<br />
          <span className="results-title-accent">Results.</span>
        </h1>
        <p className="results-sub">All-time practice history across every topic.</p>
      </div>

      {loading ? (
        <p className="results-loading">Loading results…</p>
      ) : error ? (
        <p className="results-loading">⚠️ {error}</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="results-stats">
            <div className="results-section-label">Overview</div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-value">{total}</div>
                <div className="stat-card-label">Attempts</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value">{total - correct}</div>
                <div className="stat-card-label">Incorrect</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-value">{accuracy}%</div>
                <div className="stat-card-label">Accuracy</div>
                <div className="stat-card-sub">{correct} correct</div>
              </div>
            </div>
          </div>

          {/* Accuracy by topic */}
          <div className="results-section">
            <div className="results-section-label">Accuracy by Topic</div>
            <div className="results-block">
              {[...topicStats]
                .sort((a, b) => a.accuracy - b.accuracy)
                .map((t) => <TopicBar key={t.topic} {...t} />)}
            </div>
          </div>

          {/* Charts */}
          <div className="results-section">
            <div className="results-section-label">Charts</div>
            <div className="results-charts">
              <div className="results-block">
                <div className="results-block-label">Attempts per Topic</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topicStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="topic"
                      tick={{ fill: "var(--text-dimmer)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-dimmer)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltipBar />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="correct" stackId="a" fill={GREEN} />
                    <Bar dataKey="incorrect" stackId="a" fill={RED} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  {[[GREEN, "Correct"], [RED, "Incorrect"]].map(([c, l]) => (
                    <div key={l} className="chart-legend-item">
                      <div className="chart-legend-dot" style={{ background: c }} />
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              <div className="results-block">
                <div className="results-block-label">Overall Split</div>
                <PieChart width={260} height={200}>
                  <Pie
                    data={pieData}
                    cx={125} cy={90}
                    innerRadius={55} outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: "var(--text-dimmer)", fontSize: 11, fontFamily: "var(--font-mono)" }}>{v}</span>
                    )}
                  />
                  <Tooltip content={<CustomTooltipPie />} />
                </PieChart>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="results-section">
            <div className="results-section-label">Needs Practice</div>
            <div className="results-block">
              <RecommendationsPanel topicStats={topicStats} />
            </div>
          </div>

          {/* Full history table */}
          <div className="results-section">
            <div className="results-section-label">Full History</div>
            <div className="table-controls">
              {["all", "correct", "incorrect"].map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${tableFilter === f ? "active" : ""}`}
                  onClick={() => setTableFilter(f)}
                >
                  {f}
                </button>
              ))}
              <select
                className="sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="answered_at">Date</option>
                <option value="topic">Topic</option>
                <option value="correct">Result</option>
              </select>
            </div>

            {filteredResults.length === 0 ? (
              <div className="table-empty">No results to show.</div>
            ) : (
              <table className="results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Topic</th>
                    <th>Question</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td-id">{i + 1}</td>
                      <td className="td-topic">{r.topic}</td>
                      <td className="td-question">
                        <button onClick={() => onViewQuestion(r.question_id, r.topic)}>
                          {r.source || `Q#${r.question_id}`}
                        </button>
                      </td>
                      <td>
                        <span className={`badge badge--${r.correct ? "correct" : "incorrect"}`}>
                          {r.correct ? "✓ got it" : "✗ missed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}