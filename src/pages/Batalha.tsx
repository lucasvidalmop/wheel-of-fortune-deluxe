import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import BattleWheel from '@/components/casino/BattleWheel';
import { defaultBattleConfig, type BattleConfig, type BattleParticipant } from '@/components/casino/battleTypes';
import { Plus, Trash2 } from 'lucide-react';

export default function Batalha() {
  const [config, setConfig] = useState<BattleConfig>(defaultBattleConfig);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [winnerHistory, setWinnerHistory] = useState<{ id: string; name: string; game?: string; at: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_battle_config_default');
        if (!cancelled && !error && data && data.length > 0) {
          const remote = data[0]?.config as Partial<BattleConfig> | null;
          if (remote && typeof remote === 'object') {
            setConfig({ ...defaultBattleConfig, ...remote });
          }
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
  }, []);

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

  const removeParticipant = (id: string) =>
    setParticipants((prev) => prev.filter((p) => p.id !== id));

  const updateScore = (id: string, score: number) =>
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, score } : p)));

  const handleWinner = (w: BattleParticipant) => {
    setWinnerHistory((prev) => [{ id: crypto.randomUUID(), name: w.name, game: w.game, at: Date.now() }, ...prev].slice(0, 20));
  };

  // Ranking sorted by manual score (highest first), then by name as tiebreaker.
  const rankedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [participants]);

  return (
    <main className="min-h-screen w-full px-4 py-10 lg:px-12" style={bgStyle}>
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
            <BattleWheel config={config} participants={participants} onWinner={handleWinner} />
          )}
          <div className="mt-6 text-xs tracking-[0.3em]" style={{ color: config.panelLabelColor }}>
            {participants.length} JOGADORES ATIVOS
          </div>
        </div>

        {/* Side panels */}
        <aside className="space-y-5">
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
            <div className="text-[11px] tracking-[0.35em] mb-4" style={{ color: config.panelLabelColor }}>
              RANKING
            </div>
            {participants.length === 0 ? (
              <p className="text-sm italic text-center py-6" style={{ color: config.panelLabelColor }}>
                Adicione jogadores para começar
              </p>
            ) : (
              <ul className="space-y-2">
                {rankedParticipants.map((p, idx) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: config.bgColor }}
                  >
                    <span
                      className="text-xs font-bold tabular-nums w-5 text-center"
                      style={{ color: config.panelLabelColor }}
                    >
                      {idx + 1}
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
                    <input
                      type="number"
                      value={p.score ?? 0}
                      onChange={(e) => updateScore(p.id, Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      step="any"
                      className="w-20 h-8 rounded-md px-2 text-sm text-right font-bold tabular-nums outline-none transition-shadow focus:shadow-[0_0_0_2px]"
                      style={{
                        backgroundColor: config.panelBgColor,
                        border: `1px solid ${config.inputBorderColor}55`,
                        color: config.headerAccentColor,
                      }}
                      aria-label={`Pontos de ${p.name}`}
                    />
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="opacity-50 hover:opacity-100 transition-opacity"
                      aria-label="Remover"
                      style={{ color: config.panelLabelColor }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
