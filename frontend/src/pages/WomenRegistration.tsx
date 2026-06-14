import { useState, useEffect, useCallback } from "react";
import {
  getSessions,
  updateSession,
  deleteSession,
  getRegistrations,
  createRegistration,
  clearRegistrations,
  deleteRegistration,
  type GroupSession,
  type ClassRegistration,
} from "../api";

const CLASS_META: Record<string, { color: string; bg: string }> = {
  "Body Shape":        { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "Trening Obwodowy":  { color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  "Pośladki i Brzuch": { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "WalkCore":          { color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
};
const DEFAULT_META = { color: "#7c6cfa", bg: "rgba(124,108,250,0.12)" };
const meta = (t: string) => CLASS_META[t] ?? DEFAULT_META;

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
function parseLocal(s: string): Date { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); }
function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
}

type RegMap = Record<string, { list: ClassRegistration[]; limit: number }>;

interface RegModal { session: GroupSession; }
interface EditModal { session: GroupSession; form: { time: string; class_type: string }; }

export default function WomenRegistration() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [allSessions, setAllSessions]     = useState<GroupSession[]>([]);
  const [regMap, setRegMap]               = useState<RegMap>({});
  const [regModal, setRegModal]           = useState<RegModal | null>(null);
  const [editModal, setEditModal]         = useState<EditModal | null>(null);
  const [regForm, setRegForm]             = useState({ name: "", phone: "" });
  const [submitting, setSubmitting]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [regError, setRegError]           = useState("");
  const [successMsg, setSuccessMsg]       = useState("");

  const today = new Date(); today.setHours(0,0,0,0);
  const monday = addDays(getMonday(today), weekOffset * 7);
  const sunday = addDays(monday, 6);
  const weekStart = toDateStr(monday);
  const weekEnd   = toDateStr(sunday);

  const weekSessions = allSessions
    .filter(s => s.date >= weekStart && s.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  // Group sessions by date
  const byDate: Record<string, GroupSession[]> = {};
  for (const s of weekSessions) (byDate[s.date] ??= []).push(s);

  const loadAll = useCallback(async () => {
    const res = await getSessions();
    setAllSessions(res.data);
    // load registrations for visible week
    const mon = addDays(getMonday(new Date()), weekOffset * 7);
    const sun = addDays(mon, 6);
    const ws  = toDateStr(mon);
    const we  = toDateStr(sun);
    const week = res.data.filter(s => s.date >= ws && s.date <= we);
    await Promise.all(week.map(async s => {
      const key = `${s.class_type}::${s.date}`;
      try {
        const r = await getRegistrations(s.class_type, s.date);
        setRegMap(prev => ({ ...prev, [key]: { list: r.data.registrations, limit: r.data.limit } }));
      } catch {}
    }));
  }, [weekOffset]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Registration handlers ──
  const openRegModal = (session: GroupSession) => {
    setRegModal({ session });
    setRegForm({ name: "", phone: "" });
    setRegError(""); setSuccessMsg("");
  };

  const handleRegister = async () => {
    if (!regModal) return;
    if (!regForm.name.trim()) { setRegError("Podaj imię i nazwisko"); return; }
    setSubmitting(true); setRegError("");
    try {
      const res = await createRegistration({
        class_type: regModal.session.class_type,
        class_date: regModal.session.date,
        name: regForm.name.trim(),
        phone: regForm.phone.trim(),
      });
      setSuccessMsg(res.data.status === "waitlist" ? "Dodano na listę rezerwową!" : "Zapisano na zajęcia!");
      await loadAll();
      setTimeout(() => setRegModal(null), 1700);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setRegError(err.response?.data?.error ?? "Błąd podczas zapisu");
    } finally { setSubmitting(false); }
  };

  const handleDeleteReg = async (id: number) => {
    await deleteRegistration(id); await loadAll();
  };

  // ── Session edit/delete handlers ──
  const openEditModal = (s: GroupSession) =>
    setEditModal({ session: s, form: { time: s.time, class_type: s.class_type } });

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await updateSession(editModal.session.id, editModal.form);
      // if class_type changed: clear old registrations (orphaned), new slot starts fresh
      if (editModal.form.class_type !== editModal.session.class_type) {
        await clearRegistrations(editModal.session.class_type, editModal.session.date);
      }
      setEditModal(null);
      await loadAll();
    } finally { setSaving(false); }
  };

  const handleDeleteSession = async (s: GroupSession) => {
    if (!confirm(`Usunąć "${s.class_type}" (${s.date})?\nWszystkie zapisy na te zajęcia też zostaną usunięte.`)) return;
    await clearRegistrations(s.class_type, s.date);
    await deleteSession(s.id);
    await loadAll();
  };

  // ── Week label ──
  const firstDay = monday;
  const lastDay  = sunday;
  const weekLabel = firstDay.getMonth() === lastDay.getMonth()
    ? `${firstDay.getDate()} – ${lastDay.getDate()} ${MONTHS[lastDay.getMonth()]} ${lastDay.getFullYear()}`
    : `${fmtDay(firstDay)} – ${fmtDay(lastDay)} ${lastDay.getFullYear()}`;

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

      {/* Empty state */}
      {Object.keys(byDate).length === 0 && (
        <div className="reg-empty">
          <div className="reg-empty-icon">📅</div>
          <div className="reg-empty-title">Brak zaplanowanych zajęć w tym tygodniu</div>
          <div className="reg-empty-hint">Dodaj treningi w zakładce „Zajęcia grupowe", a pojawią się tutaj automatycznie.</div>
        </div>
      )}

      {/* Day columns */}
      <div className="reg-grid">
        {Object.entries(byDate).map(([date, sessions]) => {
          const d = parseLocal(date);
          const isPast = d < today;
          return (
            <div key={date} className="reg-day-col">
              <div className={`reg-day-header${isPast ? " reg-past" : ""}`}>
                <div>
                  <span className="reg-day-name">{DAYS_PL[d.getDay()]}</span>
                  <span className="reg-day-date">{fmtDay(d)}</span>
                </div>
                {isPast && <span className="reg-past-tag">Minione</span>}
              </div>

              {sessions.map(s => {
                const m   = meta(s.class_type);
                const key = `${s.class_type}::${s.date}`;
                const data = regMap[key];
                const limit      = CLASS_LIMITS[s.class_type] ?? 6;
                const registered = data?.list.filter(r => r.status === "registered") ?? [];
                const waitlist   = data?.list.filter(r => r.status === "waitlist")   ?? [];
                const isFull     = registered.length >= limit;

                return (
                  <div key={s.id} className="reg-slot" style={{ borderLeftColor: m.color }}>
                    {/* Header row: info + action buttons */}
                    <div className="reg-slot-top">
                      <div className="reg-slot-info">
                        <div className="reg-slot-time">{s.time || "—"}</div>
                        <div className="reg-slot-name" style={{ color: m.color }}>{s.class_type}</div>
                        <div className="reg-slot-trainer">Sara Mirecka · Wszystkie poziomy</div>
                      </div>
                      <div className="reg-slot-actions">
                        {!isPast && (
                          <button
                            className={`btn-primary${isFull ? " btn-waitlist" : ""}`}
                            style={!isFull ? { background: `linear-gradient(135deg,${m.color},${m.color}bb)`, boxShadow: `0 2px 10px ${m.color}44` } : undefined}
                            onClick={() => openRegModal(s)}
                          >
                            {isFull ? "Rezerwowa" : "Zapisz się"}
                          </button>
                        )}
                        <div className="reg-mgmt-btns">
                          <button className="btn-sm" onClick={() => openEditModal(s)} title="Edytuj zajęcia">Edytuj</button>
                          <button className="btn-sm danger" onClick={() => handleDeleteSession(s)} title="Usuń zajęcia">Usuń</button>
                        </div>
                      </div>
                    </div>

                    {/* Spot dots */}
                    <div className="reg-spots-row">
                      <div className="reg-dots">
                        {Array.from({ length: limit }, (_, i) => (
                          <span key={i} className={`reg-dot${i < registered.length ? " taken" : ""}`}
                            style={i < registered.length
                              ? { background: m.color, borderColor: m.color }
                              : { borderColor: m.color + "55" }} />
                        ))}
                      </div>
                      <span className={`reg-spots-label${isFull ? " reg-full-label" : ""}`}>
                        {isFull
                          ? waitlist.length > 0 ? `Brak miejsc · rezerwowa: ${waitlist.length}` : "Brak miejsc"
                          : `${limit - registered.length} z ${limit} wolnych`}
                      </span>
                    </div>

                    {/* Registered */}
                    {registered.length > 0 && (
                      <div className="reg-people-section">
                        <div className="reg-people-title">
                          Zapisane <span className="reg-count">{registered.length}/{limit}</span>
                        </div>
                        {registered.map((r, i) => (
                          <div key={r.id} className="reg-person">
                            <span className="reg-num">{i+1}.</span>
                            <span className="reg-avatar" style={{ background: m.bg, color: m.color }}>{initials(r.name)}</span>
                            <span className="reg-name">{r.name}</span>
                            {r.phone && <span className="reg-phone">{r.phone}</span>}
                            <button className="reg-del-btn" onClick={() => handleDeleteReg(r.id)} title="Usuń">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Waitlist */}
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
              <span style={{ color: meta(regModal.session.class_type).color }}>{regModal.session.class_type}</span>
              <div className="reg-modal-sub">
                {DAYS_PL[parseLocal(regModal.session.date).getDay()]} · {fmtDay(parseLocal(regModal.session.date))} · {regModal.session.time}
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
                    style={{ background: `linear-gradient(135deg,${meta(regModal.session.class_type).color},${meta(regModal.session.class_type).color}bb)`, boxShadow: `0 2px 10px ${meta(regModal.session.class_type).color}44` }}
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
                onChange={e => setEditModal(m => m && ({ ...m, form: { ...m.form, class_type: e.target.value } }))}>
                {CLASS_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Godzina</label>
              <input type="time" value={editModal.form.time}
                onChange={e => setEditModal(m => m && ({ ...m, form: { ...m.form, time: e.target.value } }))} />
            </div>
            {editModal.form.class_type !== editModal.session.class_type && (
              <div className="reg-error" style={{ marginBottom: 12 }}>
                Zmiana rodzaju zajęć usunie wszystkie istniejące zapisy na te zajęcia.
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
