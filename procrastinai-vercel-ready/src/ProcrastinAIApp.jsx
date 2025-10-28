\
import React, { useEffect, useMemo, useState } from "react";

/**
 * ProcrastinAI™ — functionality-first mockup.
 * Vercel-ready (Vite) with SPA rewrite via vercel.json provided in project root.
 * No external services. Data persisted in localStorage.
 */

const STORAGE_KEY = "procrastinai_state_v1";

const defaultDistractions = {
  chill: [
    "Watch a 4-hour 'quick' documentary",
    "Rearrange your desktop icons alphabetically",
    "Compare coffee bean reviews",
    "Learn three origami birds (for science)",
  ],
  curious: [
    "Open 27 tabs about medieval spoons",
    "Read the entire changelog of your OS",
    "Benchmark your Wi‑Fi by room",
    "Plan a hypothetical sabbatical in Iceland",
  ],
  frantic: [
    "Deep-clean your keyboard with a toothpick",
    "Refactor your playlists by BPM",
    "Organize cables by mood",
    "Price out label makers you'll never buy",
  ],
};

const BADGES = [
  { id: "sprout", label: "Master of Delay (15m)", thresholdMin: 15 },
  { id: "bronze", label: "Deadline Dabbler (1h)", thresholdMin: 60 },
  { id: "silver", label: "Excuse Artisan (3h)", thresholdMin: 180 },
  { id: "gold", label: "Delay Sensei (6h)", thresholdMin: 360 },
  { id: "diamond", label: "Time Wizard (12h)", thresholdMin: 720 },
];

const now = () => new Date().getTime();
const minutes = (ms) => Math.floor(ms / 60000);
const formatTimeLeft = (ms) => {
  if (ms <= 0) return "Time's up!";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
};

function useLocalState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}

function deriveMode(nearestDeadlineMs) {
  if (nearestDeadlineMs <= 0) return "Full Panic";
  const mins = nearestDeadlineMs / 60000;
  if (mins <= 60) return "Full Panic";
  if (mins <= 6 * 60) return "Strong Delay";
  return "Mild Delay";
}

export default function ProcrastinAIApp() {
  const [tasks, setTasks] = useLocalState(STORAGE_KEY + ":tasks", []);
  const [mood, setMood] = useLocalState(STORAGE_KEY + ":mood", "chill");
  const [mute, setMute] = useLocalState(STORAGE_KEY + ":mute", false);
  const [breakIntervalMin, setBreakIntervalMin] = useLocalState(
    STORAGE_KEY + ":breakIntervalMin",
    5
  );
  const [lastBreakPromptAt, setLastBreakPromptAt] = useLocalState(
    STORAGE_KEY + ":lastBreakPromptAt",
    0
  );
  const [timerRunning, setTimerRunning] = useLocalState(
    STORAGE_KEY + ":timerRunning",
    false
  );
  const [totalProcrastinatedMs, setTotalProcrastinatedMs] = useLocalState(
    STORAGE_KEY + ":totalProcrastinatedMs",
    0
  );
  const [excuseContext, setExcuseContext] = useLocalState(
    STORAGE_KEY + ":excuseContext",
    { audience: "professor", blocker: "power outage", tone: "vague" }
  );
  const [excuseHistory, setExcuseHistory] = useLocalState(
    STORAGE_KEY + ":excuseHistory",
    []
  );

  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

  // Ticker + timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTotalProcrastinatedMs((ms) => ms + 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, setTotalProcrastinatedMs]);

  // Break nudges (simple alert; muted if mute=true)
  useEffect(() => {
    if (mute) return;
    const nowMs = now();
    if (nowMs - lastBreakPromptAt >= breakIntervalMin * 60000 && breakIntervalMin > 0) {
      setLastBreakPromptAt(nowMs);
      if (!mute) alert("☕ Focus Break: you deserve a break!");
    }
  }, [breakIntervalMin, lastBreakPromptAt, mute]);

  const nearestDeadlineMs = React.useMemo(() => {
    const upcoming = tasks
      .filter((t) => t.deadline)
      .map((t) => new Date(t.deadline).getTime() - now())
      .filter((d) => !Number.isNaN(d))
      .sort((a, b) => a - b)[0];
    return typeof upcoming === "number" ? upcoming : Infinity;
  }, [tasks]);

  const adaptiveMode = deriveMode(nearestDeadlineMs);

  const suggestedDistractions = React.useMemo(() => {
    const pool = defaultDistractions[mood] || defaultDistractions.chill;
    // shuffle simple
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 3);
  }, [mood, adaptiveMode, tasks]);

  const earnedBadges = React.useMemo(() => {
    const totalMin = minutes(totalProcrastinatedMs);
    return BADGES.filter((b) => totalMin >= b.thresholdMin).map((b) => b.label);
  }, [totalProcrastinatedMs]);

  const addTask = () => {
    if (!title || !deadline) return;
    const newTask = {
      id: String(Math.random()).slice(2),
      title,
      deadline,
      createdAt: now(),
      done: false,
    };
    setTasks([newTask, ...tasks]);
    setTitle("");
    setDeadline("");
  };

  const toggleTask = (id) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTask = (id) => setTasks((ts) => ts.filter((t) => t.id !== id));

  const startTimer = () => setTimerRunning(true);
  const stopTimer = () => setTimerRunning(false);
  const resetTimer = () => {
    setTimerRunning(false);
    setTotalProcrastinatedMs(0);
  };

  const generateExcuse = () => {
    const txt = buildExcuse(excuseContext);
    setExcuseHistory((h) => [{ id: String(Math.random()).slice(2), txt, at: now() }, ...h]);
  };

  const nearestDeadlineLabel = React.useMemo(() => {
    if (!isFinite(nearestDeadlineMs)) return "No deadlines";
    return formatTimeLeft(nearestDeadlineMs);
  }, [nearestDeadlineMs]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>ProcrastinAI™</h1>
          <div style={{ opacity: 0.7 }}>Because deadlines are just suggestions.</div>
        </div>
        <div style={{ opacity: 0.6, fontSize: 12 }}>Local demo · no servers</div>
      </div>

      {/* Status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
        <StatusCard title="Adaptive Mode" value={adaptiveMode} subtitle="Auto by nearest deadline" />
        <StatusCard title="Nearest Deadline" value={nearestDeadlineLabel} subtitle="Time remaining" />
        <StatusCard title="Procrastinated" value={`${minutes(totalProcrastinatedMs)} min`} subtitle="Total" />
        <StatusCard title="Notifications" value={mute ? "Muted" : "Active"} subtitle="Filter" />
      </div>

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 16 }}>
        <Card>
          <h3>Tasks & Deadlines</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="What are you avoiding?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <button onClick={addTask}>Add Task</button>
          </div>
          <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 12, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    <span style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1 }}>{t.title}</span>
                  </label>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Due: {new Date(t.deadline).toLocaleString()}</div>
                </div>
                <button onClick={() => removeTask(t.id)} style={{ fontSize: 12, opacity: 0.7 }}>Remove</button>
              </li>
            ))}
            {tasks.length === 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>No tasks yet. Add something terrifying.</div>}
          </ul>
        </Card>

        <Card>
          <h3>Distraction Engine</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Mood</label>
            <select value={mood} onChange={(e) => setMood(e.target.value)}>
              <option value="chill">Chill</option>
              <option value="curious">Curious</option>
              <option value="frantic">Frantic</option>
            </select>
          </div>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {suggestedDistractions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12 }}>Focus Break every (min)</label>
            <input style={{ width: 80, marginLeft: 8 }} type="number" min={0} value={breakIntervalMin}
                   onChange={(e) => setBreakIntervalMin(Math.max(0, Number(e.target.value)))} />
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {breakIntervalMin === 0 ? "Break nudges disabled" : `You'll get a gentle nudge every ~${breakIntervalMin} min`}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />
              Mute notifications (protect my peace)
            </label>
          </div>
        </Card>

        <Card>
          <h3>Procrastination Timer</h3>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatTimeLeft(totalProcrastinatedMs)}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {!timerRunning ? (
              <button onClick={startTimer}>Start Delaying</button>
            ) : (
              <button onClick={stopTimer}>Pause Delay</button>
            )}
            <button onClick={resetTimer}>Reset</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Badges</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {BADGES.map((b) => (
                <span key={b.id} title={`${b.thresholdMin} minutes`}
                  style={{
                    fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999,
                    opacity: (earnedBadges.includes(b.label) ? 1 : 0.4)
                  }}>{b.label}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <h3>Smart Excuse Generator</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12 }}>Audience</label>
            <select value={excuseContext.audience} onChange={(e) => setExcuseContext({ ...excuseContext, audience: e.target.value })}>
              <option value="professor">Professor</option>
              <option value="boss">Boss</option>
              <option value="team">Team</option>
              <option value="friend">Friend</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12 }}>Primary blocker</label>
            <select value={excuseContext.blocker} onChange={(e) => setExcuseContext({ ...excuseContext, blocker: e.target.value })}>
              <option value="power outage">Power outage</option>
              <option value="wifi issues">Wi‑Fi issues</option>
              <option value="family emergency">Family emergency</option>
              <option value="pet situation">Pet situation</option>
              <option value="mysterious illness">Mysterious illness</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12 }}>Tone</label>
            <select value={excuseContext.tone} onChange={(e) => setExcuseContext({ ...excuseContext, tone: e.target.value })}>
              <option value="vague">Urgent but vague</option>
              <option value="formal">Overly formal</option>
              <option value="apologetic">Deeply apologetic</option>
              <option value="techy">Technical gobbledygook</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <button style={{ width: "100%" }} onClick={generateExcuse}>Generate Excuse</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {excuseHistory.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No excuses yet. Bold of you.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {excuseHistory.map((e) => (
                <li key={e.id} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 12, whiteSpace: "pre-wrap" }}>
                  <div style={{ fontSize: 14 }}>{e.txt}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        * This mockup runs entirely in your browser and stores data in localStorage.
      </div>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ border: "1px solid #ddd", borderRadius: 16, padding: 12, ...style }}>{children}</div>;
}

function StatusCard({ title, value, subtitle }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{subtitle}</div>
    </div>
  );
}

// Excuse generator logic
function buildExcuse({ audience, blocker, tone }) {
  const greet = {
    professor: "Dear Professor",
    boss: "Hi",
    team: "Hey team",
    friend: "Hey",
  }[audience];

  const opener = {
    vague: "I'm dealing with an unexpected situation today",
    formal: "I regret to inform you of an unforeseen circumstance",
    apologetic: "I'm really sorry, but something came up",
    techy: "A cascade of edge cases hit my local environment",
  }[tone];

  const causeMap = {
    "power outage": [
      "a localized power outage",
      "my apartment's power cycling like a disco",
    ],
    "wifi issues": [
      "network instability",
      "Wi‑Fi that keeps authenticating with the void",
    ],
    "family emergency": [
      "a family matter that needs my attention",
      "a sudden family situation",
    ],
    "pet situation": [
      "an urgent pet situation (he's fine, just dramatic)",
      "my cat unionizing against productivity",
    ],
    "mysterious illness": [
      "a minor but inconvenient illness",
      "an uncooperative immune system",
    ],
  };

  const cause = causeMap[blocker] || ["an issue"];
  const close = {
    vague: "Thank you for understanding.",
    formal: "I appreciate your consideration in this matter.",
    apologetic: "I appreciate your patience and I'm sorry again.",
    techy: "I'll stabilize the stack and follow up ASAP.",
  }[tone];

  const ask = {
    professor: "Could I submit by tomorrow evening?",
    boss: "Could we push the deadline 24 hours?",
    team: "Can we shift this to tomorrow's standup?",
    friend: "Can we rain-check to tomorrow?",
  }[audience];

  const body = `${greet},\\n\\n${opener} related to ${cause[Math.floor(Math.random()*cause.length)]}. I'm prioritizing resolution now and don't want to deliver something subpar. ${ask}\\n\\n${close}`;
  return body;
}
