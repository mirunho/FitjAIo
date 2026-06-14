import axios from "axios";

// In dev Vite proxies /sessions /clients /ai /health → localhost:8000
// In prod the backend serves this file from the same origin
const api = axios.create({ baseURL: "" });

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

// Registrations
export interface ClassRegistration {
  id: number;
  class_type: string;
  class_date: string;
  name: string;
  phone: string;
  status: "registered" | "waitlist";
  position: number;
  created_at: string;
}

export interface RegistrationsResponse {
  registrations: ClassRegistration[];
  limit: number;
}

export interface RegSummaryItem {
  class_type: string;
  class_date: string;
  registered: number;
  waitlist: number;
}

export const getRegistrations = (class_type: string, class_date: string) =>
  api.get<RegistrationsResponse>(
    `/registrations?class_type=${encodeURIComponent(class_type)}&class_date=${class_date}`
  );
export const getRegSummary = (date_from: string, date_to: string) =>
  api.get<RegSummaryItem[]>(`/registrations/summary?date_from=${date_from}&date_to=${date_to}`);
export const createRegistration = (data: {
  class_type: string;
  class_date: string;
  name: string;
  phone: string;
}) => api.post<ClassRegistration>("/registrations", data);
export const clearRegistrations = (class_type: string, class_date: string) =>
  api.delete(`/registrations/clear?class_type=${encodeURIComponent(class_type)}&class_date=${class_date}`);
export const deleteRegistration = (id: number) => api.delete(`/registrations/${id}`);

// AI
export const suggestGroup = (class_type: string, date: string) =>
  api.post<{ suggestion: string }>("/ai/suggest-group", { class_type, date });
export const suggestPersonal = (client_id: number, extra_context?: string) =>
  api.post<{ suggestion: string }>("/ai/suggest-personal", { client_id, extra_context });
