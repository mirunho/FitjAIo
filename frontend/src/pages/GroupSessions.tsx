import { useEffect, useState } from "react";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  suggestGroup,
  type GroupSession,
} from "../api";

const CLASS_TYPES = ["Body Shape", "Walk Core", "Pośladki i Brzuch"];

const TYPE_META: Record<string, { abbr: string; color: string; bg: string }> = {
  "Body Shape":        { abbr: "BS",  color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  "Walk Core":         { abbr: "WC",  color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
  "Pośladki i Brzuch": { abbr: "PiB", color: "#f472b6", bg: "rgba(244,114,182,0.15)" },
};

const DAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                   "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

// Tuesdays=2, Thursdays=4, Saturdays=6 (JS: 0=Sun)
const REGULAR_DAYS = new Set([2, 4, 6]);

type View = "calendar" | "history" | "list";

const empty = (date?: string): Partial<GroupSession> => ({
  date: date ?? new Date().toISOString().slice(0, 10),
  time: "10:00",
  class_type: "Body Shape",
  exercises: "",
  notes: "",
  participants: 0,
});

function fmt(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export default function GroupSessions() {
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [view, setView] = useState<View>("calendar");
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupSession | null>(null);
  const [form, setForm] = useState<Partial<GroupSession>>(empty());
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => getSessions().then((r) => setSessions(r.data));
  useEffect(() => { load(); }, []);

  const openNew = (date?: string) => {
    setEditing(null);
    setForm(empty(date));
    setAiSuggestion("");
    setShowForm(true);
  };

  const openEdit = (s: GroupSession) => {
    setEditing(s);
    setForm({ ...s });
    setAiSuggestion("");
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      editing ? await updateSession(editing.id, form) : await createSession(form);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć trening?")) return;
    await deleteSession(id);
    await load();
  };

  const getAi = async () => {
    if (!form.class_type || !form.date) return;
    setAiLoading(true); setAiSuggestion("");
    try {
      const r = await suggestGroup(form.class_type, form.date);
      setAiSuggestion(r.data.suggestion);
    } catch { setAiSuggestion("Błąd - sprawdź klucz API."); }
    finally { setAiLoading(false); }
  };

  // ── Calendar helpers ──────────────────────────────────────────────
  const sessionsByDate = sessions.reduce<Record<string, GroupSession[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s); return acc;
  }, {});

  function calDays() {
    const { year, month } = calMonth;
    const first = new Date(year, month, 1);
    // Monday-based: 0=Mon … 6=Sun
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null; jsDay: number }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null, jsDay: -1 });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date: iso, day: d, jsDay: dt.getDay() });
    }
    return cells;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  // ── History helpers ───────────────────────────────────────────────
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const byMonth: Record<string, GroupSession[]> = {};
  for (const s of sorted) {
    const key = s.date.slice(0, 7);
    (byMonth[key] ??= []).push(s);
  }
  const stats = CLASS_TYPES.map((t) => ({
    type: t,
    count: sessions.filter((s) => s.class_type === t).length,
    avgPart: Math.round(
      sessions.filter((s) => s.class_type === t && s.participants > 0)
        .reduce((sum, s, _, arr) => sum + s.participants / arr.length, 0)
    ),
  }));

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <h2>Zajęcia grupowe</h2>
        <div className="header-right">
          <div className="view-toggle">
            {(["calendar","history","list"] as View[]).map((v) => (
              <button key={v} className={`toggle-btn${view === v ? " active" : ""}`} onClick={() => setView(v)}>
                {v === "calendar" ? "Kalendarz" : v === "history" ? "Historia" : "Lista"}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => openNew()}>+ Nowy trening</button>
        </div>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="calendar-wrap">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setCalMonth(({ year, month }) =>
              month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}>‹</button>
            <span className="cal-title">{MONTHS_PL[calMonth.month]} {calMonth.year}</span>
            <button className="cal-nav-btn" onClick={() => setCalMonth(({ year, month }) =>
              month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}>›</button>
          </div>

          <div className="cal-legend">
            {CLASS_TYPES.map((t) => (
              <span key={t} className="cal-legend-item">
                <span className="cal-dot" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].abbr} – {t}
              </span>
            ))}
            <span className="cal-legend-item">
              <span className="cal-regular-badge">Wt/Cz/So</span> regularne dni
            </span>
          </div>

          <div className="cal-grid">
            {DAYS_PL.map((d) => <div key={d} className="cal-header-cell">{d}</div>)}
            {calDays().map((cell, i) => {
              if (!cell.date) return <div key={i} className="cal-cell empty" />;
              const daySessions = sessionsByDate[cell.date] ?? [];
              const isToday = cell.date === todayIso;
              const isRegular = REGULAR_DAYS.has(cell.jsDay);
              return (
                <div
                  key={i}
                  className={`cal-cell${isToday ? " today" : ""}${isRegular ? " regular" : ""}`}
                  onClick={() => openNew(cell.date!)}
                >
                  <span className="cal-day-num">{cell.day}</span>
                  <div className="cal-pills">
                    {daySessions.map((s) => (
                      <span
                        key={s.id}
                        className="cal-pill"
                        style={{ background: TYPE_META[s.class_type]?.bg, color: TYPE_META[s.class_type]?.color, borderColor: TYPE_META[s.class_type]?.color }}
                        onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                        title={`${s.class_type} ${s.time}`}
                      >
                        {TYPE_META[s.class_type]?.abbr} {s.time}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div className="history-wrap">
          {/* Stats */}
          <div className="stats-row">
            {stats.map((s) => (
              <div key={s.type} className="stat-card" style={{ borderColor: TYPE_META[s.type].color }}>
                <span className="stat-abbr" style={{ color: TYPE_META[s.type].color }}>{TYPE_META[s.type].abbr}</span>
                <span className="stat-name">{s.type}</span>
                <span className="stat-count">{s.count} treningów</span>
                {s.avgPart > 0 && <span className="stat-avg">śr. {s.avgPart} os.</span>}
              </div>
            ))}
          </div>

          {/* Timeline */}
          {Object.entries(byMonth).map(([key, monthSessions]) => {
            const [y, m] = key.split("-");
            return (
              <div key={key} className="history-month">
                <h3 className="history-month-title">{MONTHS_PL[+m - 1]} {y}</h3>
                <div className="history-entries">
                  {monthSessions.map((s) => {
                    const meta = TYPE_META[s.class_type];
                    const isOpen = expanded === s.id;
                    return (
                      <div key={s.id} className="history-entry" style={{ borderLeftColor: meta?.color }}>
                        <div className="history-entry-header" onClick={() => setExpanded(isOpen ? null : s.id)}>
                          <div className="history-entry-left">
                            <span className="history-date">{fmt(s.date)}</span>
                            {s.time && <span className="history-time">{s.time}</span>}
                            <span className="history-type-badge" style={{ background: meta?.bg, color: meta?.color }}>
                              {meta?.abbr} · {s.class_type}
                            </span>
                          </div>
                          <div className="history-entry-right">
                            {s.participants > 0 && <span className="history-part">{s.participants} os.</span>}
                            <button className="btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>Edytuj</button>
                            <button className="btn-sm danger" onClick={(e) => { e.stopPropagation(); remove(s.id); }}>Usuń</button>
                            <span className="expand-icon">{isOpen ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        {isOpen && s.exercises && (
                          <pre className="history-exercises">{s.exercises}</pre>
                        )}
                        {isOpen && s.notes && (
                          <p className="history-notes">{s.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div>
          {CLASS_TYPES.map((type) => {
            const typeSessions = sessions.filter((s) => s.class_type === type);
            const meta = TYPE_META[type];
            return (
              <div key={type} className="type-section">
                <h3 className="type-title" style={{ color: meta.color }}>
                  {meta.abbr} · {type}
                  <span className="type-count">{typeSessions.length} treningów</span>
                </h3>
                {typeSessions.length === 0 && <p className="empty">Brak treningów.</p>}
                <div className="cards">
                  {typeSessions.map((s) => (
                    <div key={s.id} className="card" style={{ borderTopColor: meta.color, borderTopWidth: 2 }}>
                      <div className="card-header">
                        <span className="card-date">{fmt(s.date)} {s.time}</span>
                        <span className="card-participants">{s.participants > 0 ? `${s.participants} os.` : ""}</span>
                      </div>
                      {s.exercises && (
                        <pre className="card-exercises">{s.exercises.slice(0, 200)}{s.exercises.length > 200 ? "…" : ""}</pre>
                      )}
                      {s.notes && <p className="card-notes">{s.notes}</p>}
                      <div className="card-actions">
                        <button className="btn-sm" onClick={() => openEdit(s)}>Edytuj</button>
                        <button className="btn-sm danger" onClick={() => remove(s.id)}>Usuń</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SESSION FORM MODAL ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edytuj trening" : "Nowy trening"}</h3>

            <div className="form-row two-col">
              <div>
                <label>Data</label>
                <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label>Godzina</label>
                <input type="time" value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>Rodzaj zajęć</label>
                <select value={form.class_type || ""} onChange={(e) => setForm({ ...form, class_type: e.target.value })}>
                  {CLASS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Uczestnicy</label>
                <input type="number" min={0} value={form.participants || 0} onChange={(e) => setForm({ ...form, participants: +e.target.value })} />
              </div>
            </div>

            <div className="ai-section">
              <button className="btn-ai" onClick={getAi} disabled={aiLoading}>
                {aiLoading ? "Generowanie…" : "✨ Sugestia AI"}
              </button>
              <span className="ai-hint">Haiku sprawdzi historię i zaproponuje plan</span>
            </div>

            {aiSuggestion && (
              <div className="ai-box">
                <pre>{aiSuggestion}</pre>
                <div className="ai-actions">
                  <button className="btn-secondary" onClick={() => { setForm((f) => ({ ...f, exercises: aiSuggestion })); setAiSuggestion(""); }}>Użyj jako plan</button>
                  <button className="btn-ghost" onClick={() => setAiSuggestion("")}>Odrzuć</button>
                </div>
              </div>
            )}

            <div className="form-row">
              <label>Plan ćwiczeń</label>
              <textarea rows={8} value={form.exercises || ""} onChange={(e) => setForm({ ...form, exercises: e.target.value })} placeholder={"Rozgrzewka: …\nGłówna: …"} />
            </div>
            <div className="form-row">
              <label>Notatki</label>
              <textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Uwagi…" />
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Zapisywanie…" : "Zapisz"}</button>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
