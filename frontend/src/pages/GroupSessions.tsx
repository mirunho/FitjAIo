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

const empty = (): Partial<GroupSession> => ({
  date: new Date().toISOString().slice(0, 10),
  time: "10:00",
  class_type: "Body Shape",
  exercises: "",
  notes: "",
  participants: 0,
});

export default function GroupSessions() {
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupSession | null>(null);
  const [form, setForm] = useState<Partial<GroupSession>>(empty());
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => getSessions().then((r) => setSessions(r.data));

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty());
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
    setLoading(true);
    try {
      if (editing) {
        await updateSession(editing.id, form);
      } else {
        await createSession(form);
      }
      await load();
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć trening?")) return;
    await deleteSession(id);
    await load();
  };

  const getAiSuggestion = async () => {
    if (!form.class_type || !form.date) return;
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const r = await suggestGroup(form.class_type, form.date);
      setAiSuggestion(r.data.suggestion);
    } catch {
      setAiSuggestion("Błąd - sprawdź klucz API.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAi = () => {
    setForm((f) => ({ ...f, exercises: aiSuggestion }));
    setAiSuggestion("");
  };

  const byType: Record<string, GroupSession[]> = {};
  for (const s of sessions) {
    if (!byType[s.class_type]) byType[s.class_type] = [];
    byType[s.class_type].push(s);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Zajecia grupowe</h2>
        <button className="btn-primary" onClick={openNew}>+ Nowy trening</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edytuj trening" : "Nowy trening"}</h3>

            <div className="form-row">
              <label>Data</label>
              <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Godzina</label>
              <input type="time" value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Rodzaj zajec</label>
              <select value={form.class_type || ""} onChange={(e) => setForm({ ...form, class_type: e.target.value })}>
                {CLASS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Uczestnicy</label>
              <input type="number" min={0} value={form.participants || 0} onChange={(e) => setForm({ ...form, participants: +e.target.value })} />
            </div>

            <div className="ai-section">
              <button className="btn-ai" onClick={getAiSuggestion} disabled={aiLoading}>
                {aiLoading ? "Generowanie..." : "Sugestia AI"}
              </button>
              <span className="ai-hint">Haiku podpowie cwiczenia unikajac powtorzen</span>
            </div>

            {aiSuggestion && (
              <div className="ai-box">
                <pre>{aiSuggestion}</pre>
                <div className="ai-actions">
                  <button className="btn-secondary" onClick={applyAi}>Uzyj jako plan</button>
                  <button className="btn-ghost" onClick={() => setAiSuggestion("")}>Odrzuc</button>
                </div>
              </div>
            )}

            <div className="form-row">
              <label>Plan cwiczen</label>
              <textarea
                rows={8}
                value={form.exercises || ""}
                onChange={(e) => setForm({ ...form, exercises: e.target.value })}
                placeholder="Rozgrzewka: ...\nGlowna: ..."
              />
            </div>
            <div className="form-row">
              <label>Notatki</label>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Uwagi do zajec..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={save} disabled={loading}>
                {loading ? "Zapisywanie..." : "Zapisz"}
              </button>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {CLASS_TYPES.map((type) => (
        <div key={type} className="type-section">
          <h3 className="type-title">{type}</h3>
          {(byType[type] || []).length === 0 && (
            <p className="empty">Brak treningow tego typu.</p>
          )}
          <div className="cards">
            {(byType[type] || []).map((s) => (
              <div key={s.id} className="card">
                <div className="card-header">
                  <span className="card-date">{s.date} {s.time}</span>
                  <span className="card-participants">{s.participants} os.</span>
                </div>
                {s.exercises && (
                  <pre className="card-exercises">{s.exercises.slice(0, 200)}{s.exercises.length > 200 ? "..." : ""}</pre>
                )}
                {s.notes && <p className="card-notes">{s.notes}</p>}
                <div className="card-actions">
                  <button className="btn-sm" onClick={() => openEdit(s)}>Edytuj</button>
                  <button className="btn-sm danger" onClick={() => remove(s.id)}>Usun</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
