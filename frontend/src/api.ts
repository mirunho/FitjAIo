import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000" });

export interface GroupSession {
  id: number;
  date: string;
  time: string;
  class_type: string;
  exercises: string;
  notes: string;
  participants: number;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  notes: string;
  goals: string;
  created_at: string;
}

export interface PersonalSession {
  id: number;
  client_id: number;
  date: string;
  time: string;
  exercises: string;
  trainer_notes: string;
  progress_notes: string;
  muscle_groups: string;
  created_at: string;
}

// Group sessions
export const getSessions = () => api.get<GroupSession[]>("/sessions/");
export const createSession = (data: Partial<GroupSession>) => api.post<GroupSession>("/sessions/", data);
export const updateSession = (id: number, data: Partial<GroupSession>) => api.put<GroupSession>(`/sessions/${id}`, data);
export const deleteSession = (id: number) => api.delete(`/sessions/${id}`);

// Clients
export const getClients = () => api.get<Client[]>("/clients/");
export const createClient = (data: Partial<Client>) => api.post<Client>("/clients/", data);
export const updateClient = (id: number, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data);
export const deleteClient = (id: number) => api.delete(`/clients/${id}`);

// Personal sessions
export const getPersonalSessions = (clientId: number) =>
  api.get<PersonalSession[]>(`/clients/${clientId}/sessions`);
export const createPersonalSession = (clientId: number, data: Partial<PersonalSession>) =>
  api.post<PersonalSession>(`/clients/${clientId}/sessions`, data);
export const updatePersonalSession = (clientId: number, sessionId: number, data: Partial<PersonalSession>) =>
  api.put<PersonalSession>(`/clients/${clientId}/sessions/${sessionId}`, data);
export const deletePersonalSession = (clientId: number, sessionId: number) =>
  api.delete(`/clients/${clientId}/sessions/${sessionId}`);

// AI
export const suggestGroup = (class_type: string, date: string) =>
  api.post<{ suggestion: string }>("/ai/suggest-group", { class_type, date });
export const suggestPersonal = (client_id: number, extra_context?: string) =>
  api.post<{ suggestion: string }>("/ai/suggest-personal", { client_id, extra_context });
