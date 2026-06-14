import { useState, useEffect, useCallback } from "react";
import {
  getSessions,
  updateSession,
  deleteSession,
  getRegistrations,
  createRegistration,
  clearRegistrations,
  deleteRegistration,
  getCancelledClasses,
  type GroupSession,
  type ClassRegistration,
} from "../api";

// ── Static schedule (always shown) ──────────────────────────────────
interface Slot { time: string; endTime: string; classType: string; }
interface ScheduleDay { jsDay: number; dayName: string; slots: Slot[]; }

const SCHEDULE: ScheduleDay[] = [
  {
    jsDay: 2, dayName: "Wtorek",
    slots: [
      { time: "17:50", endTime: "18:50", classType: "Body Shape" },
      { time: "19:00", endTime: "20:00", classType: "Trening Obwodowy" },
    ],
  },
  {
    jsDay: 4, dayName: "Czwartek",
    slots: [
      { time: "17:50", endTime: "18:50", classType: "Pośladki i Brzuch" },
      { time: "19:00", endTime: "20:00", classType: "WalkCore" },
    ],
  },
];

const CLASS_META: Record<string, { color: string; bg: string }> = {
  "Body Shape":        { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "Trening Obwodowy":  { color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  "Pośladki i Brzuch": { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "WalkCore":          { color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
};
const DEFAULT_META = { color: "#7c6cfa", bg: "rgba(124,108,250,0.12)" };
const m = (t: string) => CLASS_META[t] ?? DEFAULT_META;

const CLASS_LIMITS: Record<string, number> = {
  "Body Shape": 6, "Trening Obwodowy": 8,
  "Pośladki i Brzuch": 6, "WalkCore": 6,
};
const CLASS_TYPES = ["Body Shape", "Trening Obwodowy", "Pośladki i Brzuch", "WalkCore"];

const MONTHS = [
  "stycznia","lutego","marca","kwietnia","maja","czerwca",
  "lipca","sierpnia","września","października","listopada","grudnia",
];
const DAYS_PL = ["Niedziela","Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota"];

function getMonday(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtDay(d: Date): string { return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function parseLocal(s: string): Date { const [y,mo,d] = s.split("-").map(Number); return new Date(y,mo-1,d); }
function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
}

type RegMap = Record<string, { list: ClassRegistration[]; limit: number }>;
interface RegModal  { classType: string; classDate: string; time: string; }
interface EditModal { session: GroupSession; form: { time: string; class_type: string }; }

export default function WomenRegistration() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekSessions, setWeekSessions] = useState<GroupSession[]>([]);
  const [regMap, setRegMap]   = useState<RegMap>({});
  const [regModal, setRegModal]   = useState<RegModal | null>(null);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [regForm, setRegForm]     = useState({ name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [regError, setRegError]     = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [cancelledSet, setCancelledSet] = useState<Set<string>>(new Set());

  const today = new Date(); today.setHours(0,0,0,0);

  // Dates for the two visible days (always shown regardless of DB)
  const monday = addDays(getMonday(today), weekOffset * 7);
  const scheduleDays = SCHEDULE.map(s => ({ ...s, date: addDays(monday, s.jsDay - 1) }));

  const loadAll = useCallback(async () => {
    const mon = addDays(getMonday(new Date()), weekOffset * 7);
    const sun = addDays(mon, 6);
    const ws = toDateStr(mon);
    const we = toDateStr(sun);

    // Fetch DB sessions for the week (for edit/delete buttons)
    const allRes = await getSessions();
    const week   = allRes.data.filter(s => s.date >= ws && s.date <= we);
    setWeekSessions(week);

    // Fetch cancellations for the week
    try {
      const cancelled = await getCancelledClasses(ws, we);
      setCancelledSet(new Set(cancelled.data.map(c => `${c.class_type}::${c.class_date}`)));
    } catch { setCancelledSet(new Set()); }

    // Load registrations for every hardcoded slot this week
    const pairs: Array<[string, string]> = [];
    for (const sd of SCHEDULE) {
      const d = addDays(mon, sd.jsDay - 1);
      for (const slot of sd.slots) pairs.push([slot.classType, toDateStr(d)]);
    }
    await Promise.all(pairs.map(async ([classType, classDate]) => {
      const key = `${classType}::${classDate}`;
      try {
        const r = await getRegistrations(classType, classDate);
        setRegMap(prev => ({ ...prev, [key]: { list: r.data.registrations, limit: r.data.limit } }));
      } catch {}
    }));
  }, [weekOffset]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Registration modal ──
  const openRegModal = (classType: string, classDate: string, time: string) => {
    setRegModal({ classType, classDate, time });
    setRegForm({ name: "", phone: "" }); setRegError(""); setSuccessMsg("");
  };

  const handleRegister = async () => {
    if (!regModal) return;
    if (!regForm.name.trim()) { setRegError("Podaj imię i nazwisko"); return; }
    setSubmitting(true); setRegError("");
    try {
      const res = await createRegistration({
        class_type: regModal.classType, class_date: regModal.classDate,
        name: regForm.name.trim(), phone: regForm.phone.trim(),
      });
      setSuccessMsg(res.data.status === "waitlist" ? "Dodano na listę rezerwową!" : "Zapisano na zajęcia!");
      await loadAll();
      setTimeout(() => setRegModal(null), 1700);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setRegError(err.response?.data?.error ?? "Błąd podczas zapisu");
    } finally { setSubmitting(false); }
  };

  const handleDeleteReg = async (id: number) => { await deleteRegistration(id); await loadAll(); };

  // ── Session edit/delete (only for slots linked to a DB session) ──
  const openEditModal = (s: GroupSession) =>
    setEditModal({ session: s, form: { time: s.time, class_type: s.class_type } });

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await updateSession(editModal.session.id, editModal.form);
      if (editModal.form.class_type !== editModal.session.class_type)
        await clearRegistrations(editModal.session.class_type, editModal.session.date);
      setEditModal(null);
      await loadAll();
    } finally { setSaving(false); }
  };

  const handleDeleteSession = async (s: GroupSession) => {
    if (!confirm(`Usunąć "${s.class_type}" (${s.date})?\nWszystkie zapisy zostaną usunięte.`)) return;
    await clearRegistrations(s.class_type, s.date);
    await deleteSession(s.id);
    await loadAll();
  };

  // ── Week label ──
  const [first, last] = [scheduleDays[0].date, scheduleDays[scheduleDays.length-1].date];
  const weekLabel = first.getMonth() === last.getMonth()
    ? `${first.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
    : `${fmtDay(first)} – ${fmtDay(last)} ${last.getFullYear()}`;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Zapisy na zajęcia</h2>
        <div className="reg-week-nav">
          <button className="cal-nav-btn" onClick={() => setWeekOffset(o => o-1)}>‹</button>
          <span className="reg-week-label">{weekLabel}</span>
          <button className="cal-nav-btn" onClick={() => setWeekOffset(o => o+1)}>›</button>
        </div>
      </div>

      <div className="reg-grid">
        {scheduleDays.map(({ jsDay, dayName, date, slots }) => {
          const isPast  = date < today;
          const dateStr = toDateStr(date);
          return (
            <div key={jsDay} className="reg-day-col">
              <div className={`reg-day-header${isPast ? " reg-past" : ""}`}>
                <div>
                  <span className="reg-day-name">{dayName.toUpperCase()}</span>
                  <span className="reg-day-date">{fmtDay(date)}</span>
                </div>
                {isPast && <span className="reg-past-tag">Minione</span>}
              </div>

              {slots.filter(slot => !cancelledSet.has(`${slot.classType}::${dateStr}`)).map(slot => {
                const meta      = m(slot.classType);
                const key       = `${slot.classType}::${dateStr}`;
                const data      = regMap[key];
                const limit     = CLASS_LIMITS[slot.classType] ?? 6;
                const registered = data?.list.filter(r => r.status === "registered") ?? [];
                const waitlist   = data?.list.filter(r => r.status === "waitlist")   ?? [];
                const isFull     = registered.length >= limit;
                // Linked DB session — enables Edit/Delete buttons
                const linkedSession = weekSessions.find(
                  s => s.class_type === slot.classType && s.date === dateStr
                );

                return (
                  <div key={slot.classType} className="reg-slot" style={{ borderLeftColor: meta.color }}>
                    <div className="reg-slot-top">
                      <div className="reg-slot-info">
                        <div className="reg-slot-time">{slot.time} – {slot.endTime}</div>
                        <div className="reg-slot-name" style={{ color: meta.color }}>{slot.classType}</div>
                        <div className="reg-slot-trainer">Sara Mirecka · Wszystkie poziomy</div>
                      </div>
                      <div className="reg-slot-actions">
                        {!isPast && (
                          <button
                            className={`btn-primary${isFull ? " btn-waitlist" : ""}`}
                            style={!isFull ? { background: `linear-gradient(135deg,${meta.color},${meta.color}bb)`, boxShadow: `0 2px 10px ${meta.color}44` } : undefined}
                            onClick={() => openRegModal(slot.classType, dateStr, slot.time)}
                          >
                            {isFull ? "Rezerwowa" : "Zapisz się"}
                          </button>
                        )}
                        {linkedSession && (
                          <div className="reg-mgmt-btns">
                            <button className="btn-sm" onClick={() => openEditModal(linkedSession)}>Edytuj</button>
                            <button className="btn-sm danger" onClick={() => handleDeleteSession(linkedSession)}>Usuń</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Spot dots */}
                    <div className="reg-spots-row">
                      <div className="reg-dots">
                        {Array.from({ length: limit }, (_, i) => (
                          <span key={i} className={`reg-dot${i < registered.length ? " taken" : ""}`}
                            style={i < registered.length
                              ? { background: meta.color, borderColor: meta.color }
                              : { borderColor: meta.color + "55" }}
                          />
                        ))}
                      </div>
                      <span className={`reg-spots-label${isFull ? " reg-full-label" : ""}`}>
                        {isFull
                          ? waitlist.length > 0 ? `Brak miejsc · rezerwowa: ${waitlist.length}` : "Brak miejsc"
                          : `${limit - registered.length} z ${limit} wolnych`}
                      </span>
                    </div>

                    {registered.length > 0 && (
                      <div className="reg-people-section">
                        <div className="reg-people-title">
                          Zapisane <span className="reg-count">{registered.length}/{limit}</span>
                        </div>
                        {registered.map((r, i) => (
                          <div key={r.id} className="reg-person">
                            <span className="reg-num">{i+1}.</span>
                            <span className="reg-avatar" style={{ background: meta.bg, color: meta.color }}>{initials(r.name)}</span>
                            <span className="reg-name">{r.name}</span>
                            {r.phone && <span className="reg-phone">{r.phone}</span>}
                            <button className="reg-del-btn" onClick={() => handleDeleteReg(r.id)} title="Usuń">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {waitlist.length > 0 && (
                      <div className="reg-people-section reg-waitlist-section">
                        <div className="reg-people-title reg-waitlist-title">
                          Lista rezerwowa <span className="reg-count">{waitlist.length}</span>
                        </div>
                        {waitlist.map((r, i) => (
                          <div key={r.id} className="reg-person">
                            <span className="reg-num">{i+1}.</span>
                            <span className="reg-avatar" style={{ background: "rgba(245,166,35,0.12)", color: "#f5a623" }}>{initials(r.name)}</span>
                            <span className="reg-name">{r.name}</span>
                            {r.phone && <span className="reg-phone">{r.phone}</span>}
                            <button className="reg-del-btn" onClick={() => handleDeleteReg(r.id)} title="Usuń">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Registration modal ── */}
      {regModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRegModal(null)}>
          <div className="modal">
            <h3>
              <span style={{ color: m(regModal.classType).color }}>{regModal.classType}</span>
              <div className="reg-modal-sub">
                {DAYS_PL[parseLocal(regModal.classDate).getDay()]} · {fmtDay(parseLocal(regModal.classDate))} · {regModal.time}
              </div>
            </h3>
            {successMsg ? (
              <div className="reg-success">{successMsg}</div>
            ) : (
              <>
                <div className="form-row">
                  <label>Imię i nazwisko *</label>
                  <input value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="np. Anna Kowalska" autoFocus
                    onKeyDown={e => e.key === "Enter" && handleRegister()} />
                </div>
                <div className="form-row">
                  <label>Numer telefonu</label>
                  <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="np. 600 123 456"
                    onKeyDown={e => e.key === "Enter" && handleRegister()} />
                </div>
                {regError && <div className="reg-error">{regError}</div>}
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setRegModal(null)}>Anuluj</button>
                  <button className="btn-primary"
                    style={{ background: `linear-gradient(135deg,${m(regModal.classType).color},${m(regModal.classType).color}bb)`, boxShadow: `0 2px 10px ${m(regModal.classType).color}44` }}
                    onClick={handleRegister} disabled={submitting}>
                    {submitting ? "Zapisuję..." : "Zapisz się"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit session modal ── */}
      {editModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="modal">
            <h3>Edytuj zajęcia
              <div className="reg-modal-sub">{fmtDay(parseLocal(editModal.session.date))}</div>
            </h3>
            <div className="form-row">
              <label>Rodzaj zajęć</label>
              <select value={editModal.form.class_type}
                onChange={e => setEditModal(em => em && ({ ...em, form: { ...em.form, class_type: e.target.value } }))}>
                {CLASS_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Godzina</label>
              <input type="time" value={editModal.form.time}
                onChange={e => setEditModal(em => em && ({ ...em, form: { ...em.form, time: e.target.value } }))} />
            </div>
            {editModal.form.class_type !== editModal.session.class_type && (
              <div className="reg-error" style={{ marginBottom: 12 }}>
                Zmiana rodzaju zajęć usunie istniejące zapisy.
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditModal(null)}>Anuluj</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Zapisuję..." : "Zapisz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
