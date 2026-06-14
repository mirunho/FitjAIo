import { useEffect, useState } from "react";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  suggestGroup,
  getRegSummary,
  getCancelledClasses,
  cancelClass,
  restoreClass,
  type GroupSession,
  type RegSummaryItem,
} from "../api";

// ── Women's schedule (shared source of truth) ──────────────────────
interface ScheduleSlot { time: string; classType: string; }
interface ScheduleDay { jsDay: number; slots: ScheduleSlot[]; }

const WOMEN_SCHEDULE: ScheduleDay[] = [
  {
    jsDay: 2, // Tuesday
    slots: [
      { time: "17:50", classType: "Body Shape" },
      { time: "19:00", classType: "Trening Obwodowy" },
    ],
  },
  {
    jsDay: 4, // Thursday
    slots: [
      { time: "17:50", classType: "Pośladki i Brzuch" },
      { time: "19:00", classType: "WalkCore" },
    ],
  },
];
const SCHEDULE_DAYS = new Set(WOMEN_SCHEDULE.map(d => d.jsDay));

const ALL_CLASS_TYPES = [
  "Body Shape", "Trening Obwodowy", "Pośladki i Brzuch", "WalkCore",
  "Walk Core",
];

const TYPE_META: Record<string, { abbr: string; color: string; bg: string }> = {
  "Body Shape":        { abbr: "BS",  color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  "Trening Obwodowy":  { abbr: "TO",  color: "#fb923c", bg: "rgba(251,146,60,0.15)"  },
  "Pośladki i Brzuch": { abbr: "PiB", color: "#f472b6", bg: "rgba(244,114,182,0.15)" },
  "WalkCore":          { abbr: "WC",  color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
  "Walk Core":         { abbr: "WC",  color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
};

const DAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                   "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

type View = "calendar" | "history" | "list";

const empty = (date?: string, classType?: string, time?: string): Partial<GroupSession> => ({
  date: date ?? new Date().toISOString().slice(0, 10),
  time: time ?? "10:00",
  class_type: classType ?? "Body Shape",
  exercises: "",
  notes: "",
  participants: 0,
});

function fmt(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

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
  const [regSummary, setRegSummary] = useState<Record<string, RegSummaryItem>>({});
  const [cancelledSet, setCancelledSet] = useState<Set<string>>(new Set());

  const load = () => getSessions().then((r) => setSessions(r.data));
  useEffect(() => { load(); }, []);

  // Load registration counts + cancellations for the visible calendar month
  useEffect(() => {
    if (view !== "calendar") return;
    const { year, month } = calMonth;
    const dateFrom = `${year}-${pad2(month + 1)}-01`;
    const dateTo   = `${year}-${pad2(month + 1)}-${new Date(year, month + 1, 0).getDate()}`;

    getRegSummary(dateFrom, dateTo)
      .then((r) => {
        const map: Record<string, RegSummaryItem> = {};
        for (const item of r.data) map[`${item.class_type}::${item.class_date}`] = item;
        setRegSummary(map);
      })
      .catch(() => {});

    getCancelledClasses(dateFrom, dateTo)
      .then((r) => {
        setCancelledSet(new Set(r.data.map(c => `${c.class_type}::${c.class_date}`)));
      })
      .catch(() => {});
  }, [view, calMonth]);

  const openNew = (date?: string, classType?: string, time?: string) => {
    setEditing(null);
    setForm(empty(date, classType, time));
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

  const handleCancelSlot = async (classType: string, dateStr: string) => {
    if (!confirm(`Odwołać "${classType}" (${dateStr})?\nZapisy zostaną usunięte.`)) return;
    await cancelClass(classType, dateStr);
    setCancelledSet(prev => new Set(prev).add(`${classType}::${dateStr}`));
    // Also remove any linked DB session
    const linked = sessions.find(s => s.class_type === classType && s.date === dateStr);
    if (linked) {
      await deleteSession(linked.id);
      await load();
    }
  };

  const handleRestoreSlot = async (classType: string, dateStr: string) => {
    await restoreClass(classType, dateStr);
    setCancelledSet(prev => {
      const next = new Set(prev);
      next.delete(`${classType}::${dateStr}`);
      return next;
    });
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
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: string | null; day: number | null; jsDay: number }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null, jsDay: -1 });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const iso = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      cells.push({ date: iso, day: d, jsDay: dt.getDay() });
    }
    return cells;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  // Find which schedule slots this jsDay has
  function getScheduleSlots(jsDay: number): ScheduleSlot[] {
    const day = WOMEN_SCHEDULE.find(d => d.jsDay === jsDay);
    return day?.slots ?? [];
  }

  // ── History helpers ───────────────────────────────────────────────
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const byMonth: Record<string, GroupSession[]> = {};
  for (const s of sorted) {
    const key = s.date.slice(0, 7);
    (byMonth[key] ??= []).push(s);
  }
  const stats = ALL_CLASS_TYPES.filter(t => sessions.some(s => s.class_type === t)).map((t) => ({
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
            <button className="cal-today-btn" onClick={() => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }); }}>Dzisiaj</button>
          </div>

          <div className="cal-legend">
            {Object.entries(TYPE_META).filter(([k]) => k !== "Walk Core").map(([t, meta]) => (
              <span key={t} className="cal-legend-item">
                <span className="cal-dot" style={{ background: meta.color }} />
                {meta.abbr} – {t}
              </span>
            ))}
          </div>

          <div className="cal-grid">
            {DAYS_PL.map((d) => <div key={d} className="cal-header-cell">{d}</div>)}
            {calDays().map((cell, i) => {
              if (!cell.date) return <div key={i} className="cal-cell empty" />;
              const daySessions = sessionsByDate[cell.date] ?? [];
              const isToday = cell.date === todayIso;
              const isScheduleDay = SCHEDULE_DAYS.has(cell.jsDay);
              const scheduleSlots = getScheduleSlots(cell.jsDay);

              return (
                <div
                  key={i}
                  className={`cal-cell${isToday ? " today" : ""}${isScheduleDay ? " regular" : ""}`}
                  onClick={() => openNew(cell.date!)}
                >
                  <span className="cal-day-num">{cell.day}</span>
                  <div className="cal-pills">
                    {/* Schedule slots (women's classes) */}
                    {scheduleSlots.map((slot) => {
                      const meta = TYPE_META[slot.classType];
                      const key = `${slot.classType}::${cell.date}`;
                      const isCancelled = cancelledSet.has(key);
                      const reg = regSummary[key];
                      const badge = reg
                        ? ` · ${reg.registered}${reg.waitlist > 0 ? `+${reg.waitlist}` : ""}`
                        : "";
                      const linked = daySessions.find(s => s.class_type === slot.classType);

                      return (
                        <span
                          key={`sched-${slot.classType}`}
                          className={`cal-pill${isCancelled ? " cal-pill-cancelled" : ""}`}
                          style={{
                            background: isCancelled ? "transparent" : meta?.bg,
                            color: isCancelled ? "var(--text3)" : meta?.color,
                            borderColor: isCancelled ? "var(--border)" : meta?.color,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isCancelled) {
                              handleRestoreSlot(slot.classType, cell.date!);
                            } else if (linked) {
                              openEdit(linked);
                            } else {
                              openNew(cell.date!, slot.classType, slot.time);
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!isCancelled) handleCancelSlot(slot.classType, cell.date!);
                          }}
                          title={
                            isCancelled
                              ? `${slot.classType} — ODWOŁANE (kliknij aby przywrócić)`
                              : `${slot.classType} ${slot.time}${reg ? ` — ${reg.registered} zapisanych` : ""}${linked ? "" : " (kliknij aby zaplanować)"}`
                          }
                        >
                          {meta?.abbr}{isCancelled ? " ✕" : ""}{badge}
                        </span>
                      );
                    })}
                    {/* Extra DB sessions not in schedule */}
                    {daySessions
                      .filter(s => !scheduleSlots.some(sl => sl.classType === s.class_type))
                      .map((s) => {
                        const meta = TYPE_META[s.class_type];
                        const reg = regSummary[`${s.class_type}::${s.date}`];
                        const badge = reg
                          ? ` · ${reg.registered}${reg.waitlist > 0 ? `+${reg.waitlist}` : ""}`
                          : "";
                        return (
                          <span
                            key={s.id}
                            className="cal-pill"
                            style={{ background: meta?.bg ?? "rgba(124,108,250,0.15)", color: meta?.color ?? "#7c6cfa", borderColor: meta?.color ?? "#7c6cfa" }}
                            onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                            title={`${s.class_type} ${s.time}${reg ? ` — ${reg.registered} zapisanych` : ""}`}
                          >
                            {meta?.abbr ?? s.class_type.slice(0, 3)} {s.time}{badge}
                          </span>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cal-help">
            Kliknij zajęcia aby edytować · Prawy przycisk myszy aby odwołać · Odwołane zajęcia znikają z Zapisów
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === "history" && (
        <div className="history-wrap">
          <div className="stats-row">
            {stats.map((s) => (
              <div key={s.type} className="stat-card" style={{ borderColor: TYPE_META[s.type]?.color }}>
                <span className="stat-abbr" style={{ color: TYPE_META[s.type]?.color }}>{TYPE_META[s.type]?.abbr}</span>
                <span className="stat-name">{s.type}</span>
                <span className="stat-count">{s.count} treningów</span>
                {s.avgPart > 0 && <span className="stat-avg">śr. {s.avgPart} os.</span>}
              </div>
            ))}
          </div>

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
          {ALL_CLASS_TYPES.filter(t => sessions.some(s => s.class_type === t)).map((type) => {
            const typeSessions = sessions.filter((s) => s.class_type === type);
            const meta = TYPE_META[type];
            return (
              <div key={type} className="type-section">
                <h3 className="type-title" style={{ color: meta?.color }}>
                  {meta?.abbr} · {type}
                  <span className="type-count">{typeSessions.length} treningów</span>
                </h3>
                {typeSessions.length === 0 && <p className="empty">Brak treningów.</p>}
                <div className="cards">
                  {typeSessions.map((s) => (
                    <div key={s.id} className="card" style={{ borderTopColor: meta?.color, borderTopWidth: 2 }}>
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
                  {ALL_CLASS_TYPES.map((t) => <option key={t}>{t}</option>)}
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
