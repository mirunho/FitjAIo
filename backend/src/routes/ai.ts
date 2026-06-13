import { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db";

const CONTEXT = `Trener personalny prowadzi zajęcia grupowe:
- Body Shape (BS): cardio + siła, hantle, gumy oporowe, step, ćwiczenia całego ciała - partie: nogi, pośladki, ramiona, klatka, plecy
- Walk Core (WC): marsz + core, cardio z elementami chodu, wzmacnianie tułowia i brzucha
- Pośladki i Brzuch (PiB): ćwiczenia pośladków, bioder, brzucha, gumy, wałek

Trener dba o różnorodność i progresję. Nie powtarza identycznych zestawów.`;

function getAI() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: key });
}

export async function aiRoutes(app: FastifyInstance) {
  app.post<{ Body: { class_type: string; date: string } }>("/ai/suggest-group", async (req, reply) => {
    const { class_type, date } = req.body;
    if (!class_type || !date) return reply.status(400).send({ error: "class_type and date required" });

    const db = getDb();
    const recent = db.prepare(
      "SELECT date, exercises FROM group_sessions WHERE class_type=? ORDER BY date DESC LIMIT 4"
    ).all(class_type) as Array<{ date: string; exercises: string }>;

    const historyText = recent.length
      ? recent.map((s) => `- ${s.date}: ${(s.exercises || "").slice(0, 250)}`).join("\n")
      : "Brak historii - to pierwszy trening tego typu.";

    const prompt = `${CONTEXT}

Rodzaj zajęć: ${class_type}
Data: ${date}

Ostatnie treningi tego typu:
${historyText}

Zaproponuj plan treningu. Wymogi:
1. Unikaj powtórzenia ćwiczeń z ostatnich 2 treningów
2. Zadbaj o różnorodność partii mięśniowych
3. Rozgrzewka (5-7 ćwiczeń) + część główna (8-12 ćwiczeń)
4. Krótkie nazwy ćwiczeń + opcjonalnie serie/powtórzenia
Odpowiedź po polsku, zwięźle.`;

    try {
      const ai = getAI();
      const msg = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });
      return { suggestion: (msg.content[0] as { text: string }).text };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post<{ Body: { client_id: number; extra_context?: string } }>("/ai/suggest-personal", async (req, reply) => {
    const { client_id, extra_context = "" } = req.body;
    if (!client_id) return reply.status(400).send({ error: "client_id required" });

    const db = getDb();
    const client = db.prepare("SELECT * FROM clients WHERE id=?").get(client_id) as {
      name: string; goals: string; notes: string;
    } | undefined;
    if (!client) return reply.status(404).send({ error: "Client not found" });

    const recent = db.prepare(
      "SELECT date, exercises, muscle_groups, progress_notes FROM personal_sessions WHERE client_id=? ORDER BY date DESC LIMIT 5"
    ).all(client_id) as Array<{ date: string; exercises: string; muscle_groups: string; progress_notes: string }>;

    const historyText = recent.length
      ? recent.map((s) =>
          `- ${s.date}: partie=[${s.muscle_groups || "brak"}] | ${(s.exercises || "").slice(0, 200)}${s.progress_notes ? ` | postęp: ${s.progress_notes.slice(0, 100)}` : ""}`
        ).join("\n")
      : "Brak historii - to pierwszy trening.";

    const prompt = `Jesteś asystentem trenera personalnego.

Klient: ${client.name}
Cele: ${client.goals || "nie podano"}
Notatki: ${client.notes || "brak"}

Ostatnie sesje (max 5):
${historyText}
${extra_context ? `\nDodatkowy kontekst: ${extra_context}` : ""}

Zaproponuj plan następnego treningu. Uwzględnij:
1. Partie mięśniowe trenowane ostatnio (nie przeciążaj)
2. Progresję - jeśli widać postęp, zaproponuj większy ciężar/trudniejsze warianty
3. Wyrównanie - partie rzadko trenowane
4. Rozgrzewka + część główna (ćwiczenia, serie, powtórzenia)
5. Krótka notatka: co sprawdzić na tym treningu
Odpowiedź po polsku, zwięźle.`;

    try {
      const ai = getAI();
      const msg = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      });
      return { suggestion: (msg.content[0] as { text: string }).text };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });
}
