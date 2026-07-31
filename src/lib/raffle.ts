// Tipos e utilitários do módulo de Sorteio ao Vivo.

export type RaffleStatus =
  | 'draft' | 'scheduled' | 'open' | 'closed' | 'live' | 'finished' | 'cancelled';

export type ParticipantStatus = 'approved' | 'review' | 'blocked';

export interface RaffleEventPublic {
  id: string;
  ownerId: string;
  tag: string;
  name: string;
  description: string;
  bannerUrl: string;
  rules: string;
  prizeLabel: string;
  signupUrl: string;
  minParticipants: number;
  maxParticipants: number | null;
  winnersCount: number;
  opensAt: string | null;
  closesAt: string | null;
  drawAt: string | null;
  status: RaffleStatus;
  theme: Record<string, string>;
  messages: Record<string, string>;
  lockedCount: number;
}

export interface RaffleWinner {
  name: string;
  code: string;
  position: number;
}

export interface RaffleResultPublic {
  round: number;
  executedAt: string;
  totalValid: number;
  winners: RaffleWinner[];
}

export const RAFFLE_STATUS_LABEL: Record<RaffleStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  open: 'Inscrições abertas',
  closed: 'Inscrições encerradas',
  live: 'Ao vivo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  approved: 'Aprovado',
  review: 'Em análise',
  blocked: 'Bloqueado',
};

export const RAFFLE_FLAG_LABEL: Record<string, string> = {
  ip_reused: 'Mesmo endereço de acesso de outro participante',
  ip_reused_heavy: 'Endereço de acesso repetido várias vezes',
  device_reused: 'Mesmo dispositivo de outro participante',
  many_attempts: 'Várias tentativas em pouco tempo',
  rate_burst: 'Excesso de tentativas em poucos minutos',
  no_user_agent: 'Acesso sem identificação de navegador',
  invalid_name: 'Nome inválido',
  restricted_email: 'E-mail na lista de restrição',
  restricted_account: 'ID na lista de restrição',
  restricted_ip: 'Endereço na lista de restrição',
  blacklisted_account: 'Conta bloqueada no sistema',
};

/** Máscara de exibição pública: "Joao Silva" -> "Jo*** S." */
export function maskName(name: string): string {
  const clean = (name || '').trim();
  if (!clean) return 'Participante';
  const parts = clean.split(/\s+/);
  const first = parts[0];
  const masked = `${first.slice(0, 2)}${'*'.repeat(Math.max(2, first.length - 2))}`;
  return parts.length > 1 ? `${masked} ${parts[parts.length - 1][0].toUpperCase()}.` : masked;
}

export function maskAccount(accountId: string): string {
  const a = (accountId || '').trim();
  if (a.length <= 4) return '****';
  return `${a.slice(0, 4)}${'*'.repeat(Math.min(4, a.length - 4))}`;
}

/** Fingerprint leve e estável do navegador (sinal antifraude, não identidade). */
export function deviceFingerprint(): string {
  try {
    const key = 'raffle_fp_v1';
    const cached = localStorage.getItem(key);
    if (cached) return cached;
    const seed = [
      navigator.userAgent,
      navigator.language,
      String(screen.width), String(screen.height),
      String(new Date().getTimezoneOffset()),
      String((navigator as any).hardwareConcurrency || ''),
    ].join('|');
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const fp = `fp_${Math.abs(h).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, fp);
    return fp;
  } catch {
    return '';
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}
