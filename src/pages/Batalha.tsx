import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BattleWheel from '@/components/casino/BattleWheel';
import { defaultBattleConfig, type BattleConfig, type BattleParticipant } from '@/components/casino/battleTypes';
import { Plus, Trash2, Swords, LogOut, AlertTriangle, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function Batalha() {
  const [config, setConfig] = useState<BattleConfig>(defaultBattleConfig);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<(BattleParticipant & { dbId?: string })[]>([]);
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [winnerHistory, setWinnerHistory] = useState<{ id: string; name: string; game?: string; at: number }[]>([]);
  const [rankingSearch, setRankingSearch] = useState('');
  const [initialBankroll, setInitialBankroll] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(window.localStorage.getItem('battle_initial_bankroll') ?? '0');
    return Number.isFinite(v) ? v : 0;
  });
  const [tournamentEntry, setTournamentEntry] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(window.localStorage.getItem('battle_tournament_entry') ?? '0');
    return Number.isFinite(v) ? v : 0;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('battle_initial_bankroll', String(initialBankroll));
    } catch { /* ignore */ }
  }, [initialBankroll]);

  useEffect(() => {
    try {
      window.localStorage.setItem('battle_tournament_entry', String(tournamentEntry));
    } catch { /* ignore */ }
  }, [tournamentEntry]);

  // ═══ Auth state (linked to operator) ═══
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Subscribe to auth changes (set listener BEFORE getSession)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check operator permission for batalha_slot
  useEffect(() => {
    if (!session?.user?.id) {
      setHasAccess(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Admins always have access
      const { data: roleRow } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (cancelled) return;
      if (roleRow) {
        setHasAccess(true);
        return;
      }
      // Otherwise check operator_permissions (fall back to defaults)
      const [{ data: perms }, { data: defaults }] = await Promise.all([
        (supabase as any).from('operator_permissions').select('batalha_slot').eq('user_id', session.user.id).maybeSingle(),
        (supabase as any).from('operator_permissions_defaults').select('batalha_slot').eq('id', 1).maybeSingle(),
      ]);
      if (cancelled) return;
      const allowed = perms?.batalha_slot ?? defaults?.batalha_slot ?? false;
      setHasAccess(!!allowed);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Load battle_config for the LOGGED-IN operator (linked by user_id)
  useEffect(() => {
    if (!session?.user?.id || hasAccess !== true) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('battle_configs')
          .select('config')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data?.config && typeof data.config === 'object') {
          setConfig({ ...defaultBattleConfig, ...(data.config as Partial<BattleConfig>) });
        } else {
          setConfig(defaultBattleConfig);
        }
      } catch (_) {
        // fall back to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, hasAccess]);

  // Load battle_participants from BS deposits + subscribe to realtime inserts
  useEffect(() => {
    if (!session?.user?.id || hasAccess !== true) return;
    const ownerId = session.user.id;
    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase as any)
        .from('battle_participants')
        .select('id, name, game')
        .eq('owner_id', ownerId)
        .eq('consumed', false)
        .order('created_at', { ascending: true });
      if (cancelled || error || !Array.isArray(data)) return;
      setParticipants((prev) => {
        const existingDbIds = new Set(prev.map((p) => p.dbId).filter(Boolean));
        const fresh = data
          .filter((row: any) => !existingDbIds.has(row.id))
          .map((row: any) => ({
            id: crypto.randomUUID(),
            dbId: row.id as string,
            name: row.name as string,
            game: (row.game as string) || undefined,
            weight: 1,
            score: 0,
          }));
        return [...prev, ...fresh];
      });
    })();

    const channel = (supabase as any)
      .channel(`battle_participants_${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_participants',
          filter: `owner_id=eq.${ownerId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row || row.consumed) return;
          setParticipants((prev) => {
            if (prev.some((p) => p.dbId === row.id)) return prev;
            const newP = {
              id: crypto.randomUUID(),
              dbId: row.id as string,
              name: row.name as string,
              game: (row.game as string) || undefined,
              weight: 1,
              score: 0,
            };
            toast.success(`Novo participante: ${newP.name}${newP.game ? ` (${newP.game})` : ''}`);
            return [...prev, newP];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      try { (supabase as any).removeChannel(channel); } catch (_) { /* noop */ }
    };
  }, [session?.user?.id, hasAccess]);

  // SEO
  useEffect(() => {
    document.title = config.seoTitle || `${config.pageTitle}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', config.seoDescription || 'Slot Battle — sorteio entre participantes.');
    if (config.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = config.faviconUrl;
    }
  }, [config]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) toast.error(error.message);
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setHasAccess(null);
    setParticipants([]);
    setEliminatedIds(new Set());
    setWinnerHistory([]);
  };

  const bgStyle: React.CSSProperties = {
    backgroundColor: config.bgColor,
    backgroundImage: config.bgImageUrl ? `url(${config.bgImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: config.panelTextColor,
  };

  const addParticipant = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p: BattleParticipant = {
      id: crypto.randomUUID(),
      name: trimmed,
      game: game.trim() || undefined,
      weight: 1,
      score: 0,
    };
    setParticipants((prev) => [...prev, p]);
    setName('');
    setGame('');
  };

  const removeParticipant = (id: string) => {
    const target = participants.find((p) => p.id === id);
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setEliminatedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (target?.dbId) {
      (supabase as any)
        .from('battle_participants')
        .update({ consumed: true })
        .eq('id', target.dbId)
        .then(({ error }: any) => {
          if (error) console.warn('Failed to mark participant consumed:', error);
        });
    }
  };

  const updateScore = (id: string, score: number) =>
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, score } : p)));

  const handleWinner = (w: BattleParticipant) => {
    setWinnerHistory((prev) => [{ id: crypto.randomUUID(), name: w.name, game: w.game, at: Date.now() }, ...prev].slice(0, 20));
    // Remove the winner from the wheel but keep them in the ranking.
    setEliminatedIds((prev) => {
      const next = new Set(prev);
      next.add(w.id);
      return next;
    });
    const target = participants.find((p) => p.id === w.id) as (BattleParticipant & { dbId?: string }) | undefined;
    if (target?.dbId) {
      (supabase as any)
        .from('battle_participants')
        .update({ consumed: true })
        .eq('id', target.dbId)
        .then(({ error }: any) => {
          if (error) console.warn('Failed to mark winner consumed:', error);
        });
    }
  };

  // Active participants on the wheel (not yet drawn).
  const activeParticipants = useMemo(
    () => participants.filter((p) => !eliminatedIds.has(p.id)),
    [participants, eliminatedIds],
  );

  const resetWheel = () => setEliminatedIds(new Set());

  // Ranking sorted by manual score (highest first), then by name as tiebreaker.
  const rankedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [participants]);

  // Bankroll calculator:
  // For each participant: net cost to house = bonus paid (score) − tournament entry value.
  // BANCA TOTAL = initial bankroll − Σ (bonus − entrada).
  const participantsNet = useMemo(
    () => participants.reduce((sum, p) => sum + ((p.score ?? 0) - tournamentEntry), 0),
    [participants, tournamentEntry],
  );
  const totalBankroll = initialBankroll - participantsNet;
  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ═══ While auth is loading ═══
  if (!authReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="opacity-60 text-sm">Carregando...</div>
      </main>
    );
  }

  // ═══ LOGIN ═══
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-destructive/10 blur-[120px]" />
        <div className="w-full max-w-sm mx-4 p-8 space-y-6 relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <Swords className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Batalha Slot</h1>
            <p className="text-sm text-muted-foreground">Entre com sua conta de operador</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <input
                type="email"
                placeholder="operador@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:brightness-110 transition-all shadow-lg shadow-primary/25"
            >
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══ ACCESS DENIED ═══
  if (hasAccess === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="p-8 text-center space-y-4 max-w-sm mx-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground">
            Sua conta de operador não possui permissão para a Batalha Slot. Solicite acesso ao administrador.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-foreground text-sm hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>
    );
  }

  // ═══ Permission check still loading ═══
  if (hasAccess === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="opacity-60 text-sm">Validando acesso...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-4 py-10 lg:px-12 relative" style={bgStyle}>
      {/* Logout button */}
      <button
        onClick={handleLogout}
        title="Sair"
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs tracking-[0.2em] transition-opacity hover:opacity-80"
        style={{
          color: config.panelLabelColor,
          border: `1px solid ${config.panelBorderColor}`,
          backgroundColor: config.panelBgColor,
        }}
      >
        <LogOut size={12} /> SAIR
      </button>

      {/* Header */}
      <header className="text-center mb-10">
        {config.headerMode !== 'image' && (
          <h1
            className="font-black tracking-tight"
            style={{
              fontSize: `clamp(36px, 6vw, ${config.headerTitleSize}px)`,
              color: config.titleColor,
              letterSpacing: '0.02em',
            }}
          >
            {config.pageTitle}
          </h1>
        )}
        {config.headerMode === 'image' && config.headerImageUrl && (
          <img src={config.headerImageUrl} alt={config.pageTitle} style={{ maxWidth: config.headerImageSize }} className="mx-auto" />
        )}
        {config.headerMode === 'image_text' && config.headerImageUrl && (
          <img src={config.headerImageUrl} alt={config.pageTitle} style={{ maxWidth: config.headerImageSize }} className="mx-auto mb-3" />
        )}
        <div
          className="mx-auto mt-3"
          style={{
            width: 80,
            height: 2,
            backgroundColor: config.headerAccentColor,
            boxShadow: `0 0 12px ${config.headerAccentColor}`,
          }}
        />
        {config.pageSubtitle && (
          <p className="mt-3 opacity-70" style={{ fontSize: config.headerSubtitleSize }}>
            {config.pageSubtitle}
          </p>
        )}
      </header>

      {/* Layout */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
        {/* Wheel */}
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="opacity-60">Carregando...</div>
          ) : (
            <BattleWheel config={config} participants={activeParticipants} onWinner={handleWinner} />
          )}
          <div className="mt-6 text-xs tracking-[0.3em]" style={{ color: config.panelLabelColor }}>
            {activeParticipants.length} JOGADORES ATIVOS
          </div>
          {participants.length > 0 && activeParticipants.length === 0 && (
            <button
              onClick={resetWheel}
              className="mt-3 text-xs tracking-[0.2em] px-4 py-2 rounded-md transition-opacity hover:opacity-80"
              style={{
                color: config.headerAccentColor,
                border: `1px solid ${config.headerAccentColor}55`,
                backgroundColor: 'transparent',
              }}
            >
              REINICIAR ROLETA
            </button>
          )}
        </div>

        {/* Side panels */}
        <aside className="space-y-5">
          {/* Bankroll calculator */}
          <section
            className="rounded-2xl p-5"
            style={{
              backgroundColor: config.panelBgColor,
              border: `1px solid ${config.panelBorderColor}`,
            }}
          >
            <div className="text-[11px] tracking-[0.35em] mb-4" style={{ color: config.panelLabelColor }}>
              BANCA
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] tracking-[0.2em] mb-1.5" style={{ color: config.panelLabelColor }}>
                  BANCA INICIAL
                </label>
                <div
                  className="flex items-center gap-1.5 rounded-lg px-2.5 h-10"
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${config.inputBorderColor}55`,
                  }}
                >
                  <span className="text-[11px] font-bold" style={{ color: config.headerAccentColor }}>R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    name="battle-initial-bankroll"
                    value={initialBankroll ? fmtBRL(initialBankroll) : ''}
                    placeholder="0,00"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const cents = digits === '' ? 0 : Number(digits);
                      setInitialBankroll(cents / 100);
                    }}
                    className="battle-money-input w-full bg-transparent text-sm text-right font-bold tabular-nums outline-none"
                    style={{ color: config.panelTextColor }}
                    aria-label="Banca inicial"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.2em] mb-1.5" style={{ color: config.panelLabelColor }}>
                  VALOR DO TORNEIO
                </label>
                <div
                  className="flex items-center gap-1.5 rounded-lg px-2.5 h-10"
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${config.inputBorderColor}55`,
                  }}
                >
                  <span className="text-[11px] font-bold" style={{ color: config.headerAccentColor }}>R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    name="battle-tournament-entry"
                    value={tournamentEntry ? fmtBRL(tournamentEntry) : ''}
                    placeholder="0,00"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      const cents = digits === '' ? 0 : Number(digits);
                      setTournamentEntry(cents / 100);
                    }}
                    className="battle-money-input w-full bg-transparent text-sm text-right font-bold tabular-nums outline-none"
                    style={{ color: config.panelTextColor }}
                    aria-label="Valor do torneio"
                  />
                </div>
              </div>
            </div>

            <div
              className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: `1px solid ${config.panelBorderColor}` }}
            >
              <span className="text-[10px] tracking-[0.3em]" style={{ color: config.panelLabelColor }}>
                BANCA TOTAL DE PRÊMIO
              </span>
              <span
                className="text-xl font-extrabold tabular-nums"
                style={{
                  color: config.headerAccentColor,
                  textShadow: `0 0 12px ${config.headerAccentColor}66`,
                }}
              >
                R$ {fmtBRL(totalBankroll)}
              </span>
            </div>
          </section>

          {/* Novo jogador */}
          <section
            className="rounded-2xl p-5"
            style={{
              backgroundColor: config.panelBgColor,
              border: `1px solid ${config.panelBorderColor}`,
            }}
          >
            <div className="text-[11px] tracking-[0.35em] mb-4" style={{ color: config.panelLabelColor }}>
              NOVO JOGADOR
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                placeholder="Nome do jogador"
                className="w-full h-11 rounded-full px-4 text-sm outline-none transition-shadow focus:shadow-[0_0_0_2px] focus:shadow-current/20"
                style={{
                  backgroundColor: config.bgColor,
                  border: `1px solid ${config.inputBorderColor}55`,
                  color: config.inputTextColor,
                }}
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                  placeholder="Jogo escolhido (ex: Fortune Tiger)"
                  className="flex-1 h-11 rounded-full px-4 text-sm outline-none"
                  style={{
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.inputBorderColor}55`,
                    color: config.inputTextColor,
                  }}
                />
                <button
                  onClick={addParticipant}
                  className="h-11 w-11 rounded-full inline-flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${config.inputBorderColor}`,
                    color: config.inputBorderColor,
                  }}
                  aria-label="Adicionar"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </section>

          {/* Ranking */}
          <section
            className="rounded-2xl p-5"
            style={{
              backgroundColor: config.panelBgColor,
              border: `1px solid ${config.panelBorderColor}`,
            }}
          >
            <div className="text-[11px] tracking-[0.35em] mb-3" style={{ color: config.panelLabelColor }}>
              RANKING
            </div>

            {/* Search bar */}
            {participants.length > 0 && (
              <div
                className="relative mb-3 flex items-center rounded-lg"
                style={{
                  backgroundColor: config.bgColor,
                  border: `1px solid ${config.inputBorderColor}55`,
                }}
              >
                <Search size={14} className="absolute left-3 opacity-60" style={{ color: config.panelLabelColor }} />
                <input
                  type="text"
                  value={rankingSearch}
                  onChange={(e) => setRankingSearch(e.target.value)}
                  placeholder="Pesquisar jogador..."
                  className="w-full bg-transparent pl-9 pr-3 py-2 text-sm outline-none"
                  style={{ color: config.panelTextColor }}
                />
              </div>
            )}

            {participants.length === 0 ? (
              <p className="text-sm italic text-center py-6" style={{ color: config.panelLabelColor }}>
                Adicione jogadores para começar
              </p>
            ) : (
              (() => {
                const q = rankingSearch.trim().toLowerCase();
                const filtered = q
                  ? rankedParticipants.filter(
                      (p) =>
                        p.name.toLowerCase().includes(q) ||
                        (p.game ?? '').toLowerCase().includes(q),
                    )
                  : rankedParticipants;

                if (filtered.length === 0) {
                  return (
                    <p className="text-sm italic text-center py-6" style={{ color: config.panelLabelColor }}>
                      Nenhum jogador encontrado
                    </p>
                  );
                }

                const medals = ['🥇', '🥈', '🥉'];

                return (
                  <ul
                    className="space-y-2 overflow-y-auto pr-1 battle-ranking-scroll"
                    style={{
                      maxHeight: filtered.length > 5 ? '340px' : 'none',
                      ['--scroll-thumb' as string]: `${config.headerAccentColor}66`,
                      ['--scroll-track' as string]: `${config.bgColor}`,
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${config.headerAccentColor}66 ${config.bgColor}`,
                    }}
                  >
                    {filtered.map((p) => {
                      const realIdx = rankedParticipants.findIndex((rp) => rp.id === p.id);
                      const isTop3 = realIdx < 3;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{
                            backgroundColor: config.bgColor,
                            border: isTop3 ? `1px solid ${config.headerAccentColor}55` : 'none',
                            boxShadow: isTop3 ? `0 0 12px ${config.headerAccentColor}22` : 'none',
                          }}
                        >
                          <span
                            className="font-bold tabular-nums w-6 text-center flex items-center justify-center"
                            style={{
                              color: isTop3 ? config.headerAccentColor : config.panelLabelColor,
                              fontSize: isTop3 ? '18px' : '12px',
                            }}
                          >
                            {isTop3 ? medals[realIdx] : realIdx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: config.panelTextColor }}>
                              {p.name}
                            </div>
                            {p.game && (
                              <div className="text-xs truncate" style={{ color: config.panelLabelColor }}>
                                {p.game}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className="text-xs font-bold"
                              style={{ color: config.headerAccentColor }}
                            >
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                p.score
                                  ? p.score.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  : ''
                              }
                              placeholder="0,00"
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '');
                                const cents = digits === '' ? 0 : Number(digits);
                                updateScore(p.id, cents / 100);
                              }}
                              className="w-24 h-8 rounded-md px-2 text-sm text-right font-bold tabular-nums outline-none transition-shadow focus:shadow-[0_0_0_2px] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                backgroundColor: config.panelBgColor,
                                border: `1px solid ${config.inputBorderColor}55`,
                                color: config.headerAccentColor,
                              }}
                              aria-label={`Valor de ${p.name}`}
                            />
                          </div>
                          <button
                            onClick={() => removeParticipant(p.id)}
                            className="opacity-50 hover:opacity-100 transition-opacity"
                            aria-label="Remover"
                            style={{ color: config.panelLabelColor }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
