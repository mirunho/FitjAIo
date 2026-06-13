import { useState, useEffect, useCallback } from "react";
import {
  getRegistrations,
  createRegistration,
  deleteRegistration,
  type ClassRegistration,
} from "../api";

const CLASS_META: Record<string, { color: string; bg: string; border: string }> = {
  "Body Shape":        { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "#a78bfa" },
  "Trening Obwodowy":  { color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "#fb923c" },
  "Pośladki i Brzuch": { color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "#f472b6" },
  "WalkCore":          { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "#34d399" },
};

const CLASS_LIMITS: Record<string, number> = {
  "Body Shape": 6, "Trening Obwodowy": 8,
  "Pośladki i Brzuch": 6, "WalkCore": 6,
};

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

const MONTHS = [
  "stycznia","lutego","marca","kwietnia","maja","czerwca",
  "lipca","sierpnia","września","października","listopada","grudnia",
];

function getMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtDay(d: Date): string { return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function parseLocalDate(s: string): Date {
  const [y,m,day] = s.split("-").map(Number); return new Date(y, m-1, day);
}
function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
}

interface ModalInfo { classType: string; classDate: string; time: string; endTime: string; dayName: string; }

export default function WomenRegistration() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [regMap, setRegMap] = useState<Record<string, { list: ClassRegistration[]; limit: number }>>({});
  const [modal, setModal] = useState<ModalInfo | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const today = new Date(); today.setHours(0,0,0,0);
  const monday = addDays(getMonday(today), weekOffset * 7);
  const scheduleDays = SCHEDULE.map(s => ({ ...s, date: addDays(monday, s.jsDay - 1) }));

  const loadAll = useCallback(async () => {
    const mon = addDays(getMonday(new Date()), weekOffset * 7);
    const pairs: Array<[string, string]> = [];
    for (const s of SCHEDULE)
      for (const slot of s.slots)
        pairs.push([slot.classType, toDateStr(addDays(mon, s.jsDay - 1))]);

    await Promise.all(pairs.map(async ([classType, classDate]) => {
      const key = `${classType}::${classDate}`;
      try {
        const res = await getRegistrations(classType, classDate);
        setRegMap(prev => ({ ...prev, [key]: { list: res.data.registrations, limit: res.data.limit } }));
      } catch { /* ignore */ }
    }));
  }, [weekOffset]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openModal = (info: ModalInfo) => {
    setModal(info); setForm({ name: "", phone: "" }); setFormError(""); setSuccessMsg("");
  };
  const closeModal = () => { setModal(null); setFormError(""); setSuccessMsg(""); };

  const handleRegister = async () => {
    if (!modal) return;
    if (!form.name.trim()) { setFormError("Podaj imię i nazwisko"); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await createRegistration({
        class_type: modal.classType, class_date: modal.classDate,
        name: form.name.trim(), phone: form.phone.trim(),
      });
      setSuccessMsg(res.data.status === "waitlist" ? "Dodano na listę rezerwową!" : "Zapisano na zajęcia!");
      await loadAll();
      setTimeout(closeModal, 1700);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setFormError(err.response?.data?.error ?? "Błąd podczas zapisu");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    await deleteRegistration(id); await loadAll();
  };

  const [firstDay, lastDay] = [scheduleDays[0].date, scheduleDays[scheduleDays.length-1].date];
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

      <div className="reg-grid">
        {scheduleDays.map(({ jsDay, dayName, date, slots }) => {
          const isPast = date < today;
          const dateStr = toDateStr(date);
          return (
            <div key={jsDay} className="reg-day-col">
              <div className={`reg-day-header${isPast ? " reg-past" : ""}`}>
                <div>
                  <span className="reg-day-name">{dayName}</span>
                  <span className="reg-day-date">{fmtDay(date)}</span>
                </div>
                {isPast && <span className="reg-past-tag">Minione</span>}
              </div>

              {slots.map(slot => {
                const meta = CLASS_META[slot.classType] ?? { color: "#7c6cfa", bg: "rgba(124,108,250,0.1)", border: "#7c6cfa" };
                const key = `${slot.classType}::${dateStr}`;
                const data = regMap[key];
                const limit = CLASS_LIMITS[slot.classType];
                const registered = data?.list.filter(r => r.status === "registered") ?? [];
                const waitlist  = data?.list.filter(r => r.status === "waitlist")    ?? [];
                const isFull = registered.length >= limit;

                return (
                  <div
                    key={slot.classType}
                    className="reg-slot"
                    style={{ borderLeftColor: meta.border }}
                  >
                    <div className="reg-slot-top">
                      <div className="reg-slot-info">
                        <div className="reg-slot-time">{slot.time} – {slot.endTime}</div>
                        <div className="reg-slot-name" style={{ color: meta.color }}>{slot.classType}</div>
                        <div className="reg-slot-trainer">Sara Mirecka · Wszystkie poziomy</div>
                      </div>
                      {!isPast && (
                        <button
                          className={`btn-primary${isFull ? " btn-waitlist" : ""}`}
                          style={!isFull ? { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`, boxShadow: `0 2px 10px ${meta.color}44` } : undefined}
                          onClick={() => openModal({ classType: slot.classType, classDate: dateStr, time: slot.time, endTime: slot.endTime, dayName })}
                        >
                          {isFull ? "Rezerwowa" : "Zapisz się"}
                        </button>
                      )}
                    </div>

                    {/* Spot dots */}
                    <div className="reg-spots-row">
                      <div className="reg-dots">
                        {Array.from({ length: limit }, (_, i) => (
                          <span
                            key={i}
                            className={`reg-dot${i < registered.length ? " taken" : ""}`}
                            style={i < registered.length ? { background: meta.color, borderColor: meta.color } : { borderColor: meta.color + "55" }}
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
                            <span className="reg-avatar" style={{ background: meta.bg, color: meta.color }}>
                              {initials(r.name)}
                            </span>
                            <span className="reg-name">{r.name}</span>
                            {r.phone && <span className="reg-phone">{r.phone}</span>}
                            <button className="reg-del-btn" onClick={() => handleDelete(r.id)} title="Usuń">✕</button>
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
                            <span className="reg-avatar" style={{ background: "rgba(245,166,35,0.12)", color: "#f5a623" }}>
                              {initials(r.name)}
                            </span>
                            <span className="reg-name">{r.name}</span>
                            {r.phone && <span className="reg-phone">{r.phone}</span>}
                            <button className="reg-del-btn" onClick={() => handleDelete(r.id)} title="Usuń">✕</button>
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

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h3>
              <span style={{ color: CLASS_META[modal.classType]?.color }}>{modal.classType}</span>
              <div className="reg-modal-sub">
                {modal.dayName} · {fmtDay(parseLocalDate(modal.classDate))} · {modal.time}–{modal.endTime}
              </div>
            </h3>

            {successMsg ? (
              <div className="reg-success">{successMsg}</div>
            ) : (
              <>
                <div className="form-row">
                  <label>Imię i nazwisko *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="np. Anna Kowalska"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && handleRegister()}
                  />
                </div>
                <div className="form-row">
                  <label>Numer telefonu</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="np. 600 123 456"
                    onKeyDown={e => e.key === "Enter" && handleRegister()}
                  />
                </div>
                {formError && <div className="reg-error">{formError}</div>}
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Anuluj</button>
                  <button
                    className="btn-primary"
                    style={{ background: `linear-gradient(135deg, ${CLASS_META[modal.classType]?.color}, ${CLASS_META[modal.classType]?.color}bb)`, boxShadow: `0 2px 10px ${CLASS_META[modal.classType]?.color}44` }}
                    onClick={handleRegister}
                    disabled={submitting}
                  >
                    {submitting ? "Zapisuję..." : "Zapisz się"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
