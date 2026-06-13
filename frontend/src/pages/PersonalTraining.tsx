import { useEffect, useState } from "react";
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  getPersonalSessions,
  createPersonalSession,
  updatePersonalSession,
  deletePersonalSession,
  suggestPersonal,
  Client,
  PersonalSession,
} from "../api";

const MUSCLE_GROUPS = [
  "Nogi", "Pośladki", "Brzuch", "Plecy", "Klatka", "Ramiona", "Całe ciało"
];

const emptySession = (): Partial<PersonalSession> => ({
  date: new Date().toISOString().slice(0, 10),
  time: "",
  exercises: "",
  trainer_notes: "",
  progress_notes: "",
  muscle_groups: "",
});

export default function PersonalTraining() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<PersonalSession[]>([]);

  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({ name: "", notes: "", goals: "" });

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<PersonalSession | null>(null);
  const [sessionForm, setSessionForm] = useState<Partial<PersonalSession>>(emptySession());

  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClients = () => getClients().then((r) => setClients(r.data));
  const loadSessions = (c: Client) =>
    getPersonalSessions(c.id).then((r) => setSessions(r.data));

  useEffect(() => { loadClients(); }, []);
  useEffect(() => { if (selected) loadSessions(selected); }, [selected]);

  const openNewClient = () => {
    setEditingClient(null);
    setClientForm({ name: "", notes: "", goals: "" });
    setShowClientForm(true);
  };

  const openEditClient = (c: Client) => {
    setEditingClient(c);
    setClientForm({ name: c.name, notes: c.notes, goals: c.goals });
    setShowClientForm(true);
  };

  const saveClient = async () => {
    setSaving(true);
    try {
      if (editingClient) {
        const r = await updateClient(editingClient.id, clientForm);
        if (selected?.id === editingClient.id) setSelected(r.data);
      } else {
        await createClient(clientForm);
      }
      await loadClients();
      setShowClientForm(false);
    } finally {
      setSaving(false);
    }
  };

  const removeClient = async (id: number) => {
    if (!confirm("Usunąć klienta i wszystkie jego treningi?")) return;
    await deleteClient(id);
    if (selected?.id === id) { setSelected(null); setSessions([]); }
    await loadClients();
  };

  const openNewSession = () => {
    setEditingSession(null);
    setSessionForm(emptySession());
    setAiSuggestion("");
    setAiContext("");
    setShowSessionForm(true);
  };

  const openEditSession = (s: PersonalSession) => {
    setEditingSession(s);
    setSessionForm({ ...s });
    setAiSuggestion("");
    setShowSessionForm(true);
  };

  const saveSession = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (editingSession) {
        await updatePersonalSession(selected.id, editingSession.id, sessionForm);
      } else {
        await createPersonalSession(selected.id, sessionForm);
      }
      await loadSessions(selected);
      setShowSessionForm(false);
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async (s: PersonalSession) => {
    if (!selected || !confirm("Usunąć sesję?")) return;
    await deletePersonalSession(selected.id, s.id);
    await loadSessions(selected);
  };

  const getAi = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const r = await suggestPersonal(selected.id, aiContext);
      setAiSuggestion(r.data.suggestion);
    } catch {
      setAiSuggestion("Błąd - sprawdź klucz API.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAi = () => {
    setSessionForm((f) => ({ ...f, exercises: aiSuggestion }));
    setAiSuggestion("");
  };

  const toggleMuscle = (m: string) => {
    const current = (sessionForm.muscle_groups || "").split(",").filter(Boolean);
    const updated = current.includes(m)
      ? current.filter((x) => x !== m)
      : [...current, m];
    setSessionForm({ ...sessionForm, muscle_groups: updated.join(",") });
  };

  return (
    <div className="page personal">
      <div className="personal-layout">
        {/* Client list */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>Klienci</h3>
            <button className="btn-sm" onClick={openNewClient}>+</button>
          </div>
          {clients.map((c) => (
            <div
              key={c.id}
              className={`client-item${selected?.id === c.id ? " active" : ""}`}
              onClick={() => setSelected(c)}
            >
              <span className="client-name">{c.name}</span>
              <div className="client-actions">
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openEditClient(c); }}>✏️</button>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeClient(c.id); }}>🗑</button>
              </div>
            </div>
          ))}
          {clients.length === 0 && <p className="empty">Brak klientów.</p>}
        </aside>

        {/* Session detail */}
        <div className="detail">
          {!selected ? (
            <div className="no-client">Wybierz klienta z listy lub dodaj nowego.</div>
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <h2>{selected.name}</h2>
                  {selected.goals && <p className="client-goals">Cel: {selected.goals}</p>}
                  {selected.notes && <p className="client-notes-text">{selected.notes}</p>}
                </div>
                <div className="detail-actions">
                  <button className="btn-ai" onClick={() => { setShowSessionForm(true); getAi(); }} disabled={aiLoading}>
                    {aiLoading ? "Generowanie..." : "Sugestia AI"}
                  </button>
                  <button className="btn-primary" onClick={openNewSession}>+ Nowa sesja</button>
                </div>
              </div>

              {sessions.length === 0 && <p className="empty">Brak sesji. Dodaj pierwszą!</p>}

              <div className="cards">
                {sessions.map((s) => (
                  <div key={s.id} className="card session-card">
                    <div className="card-header">
                      <span className="card-date">{s.date} {s.time}</span>
                      {s.muscle_groups && (
                        <span className="muscle-tags">
                          {s.muscle_groups.split(",").filter(Boolean).map((m) => (
                            <span key={m} className="tag">{m}</span>
                          ))}
                        </span>
                      )}
                    </div>
                    {s.exercises && <pre className="card-exercises">{s.exercises.slice(0, 300)}{s.exercises.length > 300 ? "..." : ""}</pre>}
                    {s.progress_notes && <p className="progress-note">Postep: {s.progress_notes}</p>}
                    {s.trainer_notes && <p className="trainer-note">Notatka: {s.trainer_notes}</p>}
                    <div className="card-actions">
                      <button className="btn-sm" onClick={() => openEditSession(s)}>Edytuj</button>
                      <button className="btn-sm danger" onClick={() => removeSession(s)}>Usun</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Client form modal */}
      {showClientForm && (
        <div className="modal-overlay" onClick={() => setShowClientForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingClient ? "Edytuj klienta" : "Nowy klient"}</h3>
            <div className="form-row">
              <label>Imię i nazwisko</label>
              <input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Cele</label>
              <input value={clientForm.goals} onChange={(e) => setClientForm({ ...clientForm, goals: e.target.value })} placeholder="np. redukcja, budowa masy..." />
            </div>
            <div className="form-row">
              <label>Notatki</label>
              <textarea rows={3} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} placeholder="Kontuzje, ograniczenia, uwagi..." />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={saveClient} disabled={saving || !clientForm.name}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
              <button className="btn-ghost" onClick={() => setShowClientForm(false)}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {/* Session form modal */}
      {showSessionForm && selected && (
        <div className="modal-overlay" onClick={() => setShowSessionForm(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSession ? "Edytuj sesję" : `Nowa sesja - ${selected.name}`}</h3>

            <div className="form-row two-col">
              <div>
                <label>Data</label>
                <input type="date" value={sessionForm.date || ""} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} />
              </div>
              <div>
                <label>Godzina</label>
                <input type="time" value={sessionForm.time || ""} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <label>Partie miesniowe</label>
              <div className="muscle-picker">
                {MUSCLE_GROUPS.map((m) => (
                  <button
                    key={m}
                    className={`muscle-btn${(sessionForm.muscle_groups || "").includes(m) ? " selected" : ""}`}
                    onClick={() => toggleMuscle(m)}
                    type="button"
                  >{m}</button>
                ))}
              </div>
            </div>

            <div className="ai-section">
              <div className="ai-context-row">
                <input
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="Dodatkowy kontekst dla AI (opcjonalnie)..."
                  className="ai-context-input"
                />
                <button className="btn-ai" onClick={getAi} disabled={aiLoading}>
                  {aiLoading ? "Generowanie..." : "Sugestia AI"}
                </button>
              </div>
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
              <textarea rows={8} value={sessionForm.exercises || ""} onChange={(e) => setSessionForm({ ...sessionForm, exercises: e.target.value })} placeholder="Rozgrzewka...\nGlowna czesc..." />
            </div>
            <div className="form-row">
              <label>Postep / obserwacje</label>
              <textarea rows={3} value={sessionForm.progress_notes || ""} onChange={(e) => setSessionForm({ ...sessionForm, progress_notes: e.target.value })} placeholder="Co szlo lepiej niz poprzednio? Nowe ciezary?" />
            </div>
            <div className="form-row">
              <label>Notatka trenera</label>
              <textarea rows={2} value={sessionForm.trainer_notes || ""} onChange={(e) => setSessionForm({ ...sessionForm, trainer_notes: e.target.value })} placeholder="Wewnetrzne notatki..." />
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={saveSession} disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</button>
              <button className="btn-ghost" onClick={() => setShowSessionForm(false)}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
