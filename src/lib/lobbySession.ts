// Sessão única do lobby da Gorjeta — compartilhada por todas as promoções.
// Persistida em localStorage para sobreviver ao fechamento do navegador.

const STORAGE_KEY = 'gorjeta_session_v1';

export interface LobbySession {
  wheel_user_id?: string;
  account_id: string;
  email: string;
  name?: string;
  owner_id?: string;
  lobby_tag: string;
  signed_in_at: number;
}

export function getLobbySession(): LobbySession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LobbySession;
    if (!parsed?.email || !parsed?.account_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setLobbySession(s: LobbySession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export function clearLobbySession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
