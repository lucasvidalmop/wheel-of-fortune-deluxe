const API_BASE_URL = localStorage.getItem('wheel_api_url') || '';

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('wheel_api_url', url);
};

export const getApiBaseUrl = () => {
  return localStorage.getItem('wheel_api_url') || '';
};

export interface SpinCheckResponse {
  allowed: boolean;
  spins_remaining: number;
  message?: string;
}

export interface SpinResultPayload {
  account_id: string;
  segment_title: string;
  segment_reward: string;
  segment_index: number;
}

export interface UserInfoResponse {
  name: string;
  email?: string;
  account_id?: string;
}

/**
 * Busca informações do usuário pelo account_id e email
 * Endpoint esperado no Laravel: GET /api/wheel/user-info?account_id=xxx&email=yyy
 */
export const fetchUserInfo = async (accountId: string, email: string): Promise<UserInfoResponse | null> => {
  const base = getApiBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/wheel/user-info?account_id=${encodeURIComponent(accountId)}&email=${encodeURIComponent(email)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar dados do usuário:', err);
    return null;
  }
};

/**
 * Verifica se o usuário tem giros disponíveis
 * Endpoint esperado no Laravel: GET /api/wheel/check-spins?account_id=xxx
 */
export const checkSpins = async (accountId: string): Promise<SpinCheckResponse> => {
  const base = getApiBaseUrl();
  if (!base) {
    return { allowed: true, spins_remaining: -1 }; // sem API = livre
  }

  try {
    const res = await fetch(`${base}/api/wheel/check-spins?account_id=${encodeURIComponent(accountId)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('Erro ao verificar giros');
    return await res.json();
  } catch (err) {
    console.error('Erro ao verificar giros:', err);
    return { allowed: false, spins_remaining: 0, message: 'Erro de conexão com o servidor' };
  }
};

/**
 * Registra o resultado do giro no backend
 * Endpoint esperado no Laravel: POST /api/wheel/spin-result
 */
export const recordSpinResult = async (payload: SpinResultPayload): Promise<boolean> => {
  const base = getApiBaseUrl();
  if (!base) return true;

  try {
    const res = await fetch(`${base}/api/wheel/spin-result`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('Erro ao registrar resultado:', err);
    return false;
  }
};
