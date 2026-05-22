import { useEffect, useMemo, useState } from "react";
import { X, Shuffle, Trophy, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Team = { code: string; name: string; flag: string };
type Group = { key: string; teams: Team[] };
type BracketTemplate = { slot: number; a: string; b: string }[];

type Props = {
  open: boolean;
  onClose: () => void;
  tag: string;
  authed: { email: string; account_id: string; name?: string } | null;
  accent?: string;
  bg?: string;
  cardBg?: string;
  text?: string;
  muted?: string;
};

type GroupPick = { first_team: string; second_team: string; third_team: string };
type BracketState = Record<string, Record<number, string>>; // round -> slot -> code

const CODE_TO_ISO2: Record<string, string> = {
  ALG: "dz", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba", BRA: "br",
  CAN: "ca", CIV: "ci", COD: "cd", COL: "co", CPV: "cv", CRO: "hr", CUW: "cw",
  CZE: "cz", ECU: "ec", EGY: "eg", ENG: "gb-eng", ESP: "es", FRA: "fr", GER: "de",
  GHA: "gh", HAI: "ht", IRN: "ir", IRQ: "iq", JOR: "jo", JPN: "jp", KOR: "kr",
  KSA: "sa", MAR: "ma", MEX: "mx", NED: "nl", NOR: "no", NZL: "nz", PAN: "pa",
  PAR: "py", POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct", SEN: "sn", SUI: "ch",
  SWE: "se", TUN: "tn", TUR: "tr", URU: "uy", USA: "us", UZB: "uz",
};

const FlagImg = ({ code, size = 20 }: { code?: string; size?: number }) => {
  const iso = code ? CODE_TO_ISO2[code] : undefined;
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={code}
      loading="lazy"
      style={{ display: "inline-block", borderRadius: 2, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}
    />
  );
};

const ROUND_LABELS: Record<string, string> = {
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semifinal",
  final: "Final",
  champion: "Campeão",
};

const ROUND_SIZES: Record<string, number> = { r16: 16, qf: 8, sf: 4, final: 2, champion: 1 };

export default function Bolao({ open, onClose, tag, authed, accent = "#d4af37", bg = "#0a0a14", cardBg = "#11111c", text = "#ffffff", muted = "#94a3b8" }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"groups" | "classification" | "bracket">("groups");
  const [config, setConfig] = useState<any>(null);
  const [entry, setEntry] = useState<any>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [picks, setPicks] = useState<Record<string, GroupPick>>({});
  const [bestThirds, setBestThirds] = useState<string[]>([]);
  const [bracket, setBracket] = useState<BracketState>({});

  const isLocked = !!entry && (entry.status === "submitted" || entry.status === "locked");
  const readOnly = isLocked || deadlinePassed;

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-bolao", {
          body: { tag, email: authed?.email, accountId: authed?.account_id },
        });
        if (cancel) return;
        if (error || !data?.found) {
          toast.error("Bolão não disponível");
          onClose();
          return;
        }
        setConfig(data.config);
        setEntry(data.entry);
        setDeadlinePassed(!!data.deadlinePassed);
        // Hydrate picks
        const p: Record<string, GroupPick> = {};
        (data.config.groups as Group[]).forEach(g => { p[g.key] = { first_team: "", second_team: "", third_team: "" }; });
        (data.entryGroups || []).forEach((g: any) => { p[g.group_key] = { first_team: g.first_team, second_team: g.second_team, third_team: g.third_team }; });
        setPicks(p);
        setBestThirds(Array.isArray(data.entry?.best_thirds) ? data.entry.best_thirds : []);
        const br: BracketState = {};
        (data.entryBracket || []).forEach((b: any) => { (br[b.round] ||= {})[b.slot] = b.team_code; });
        setBracket(br);
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, tag, authed?.email, authed?.account_id]);

  const groups: Group[] = (config?.groups as Group[]) || [];
  const bracketTemplate: BracketTemplate = (config?.bracket_template as BracketTemplate) || [];

  const groupsFilled = useMemo(() => groups.filter(g => {
    const p = picks[g.key];
    return p && p.first_team && p.second_team && p.third_team;
  }).length, [groups, picks]);

  const setPosition = (groupKey: string, position: "first_team" | "second_team" | "third_team", code: string) => {
    if (readOnly) return;
    setPicks(prev => {
      const cur = prev[groupKey] || { first_team: "", second_team: "", third_team: "" };
      const next = { ...cur, [position]: code };
      // remove same code from other positions in this group
      (["first_team", "second_team", "third_team"] as const).forEach(k => {
        if (k !== position && next[k] === code) next[k] = "";
      });
      return { ...prev, [groupKey]: next };
    });
  };

  const randomGroup = (groupKey: string) => {
    if (readOnly) return;
    const g = groups.find(x => x.key === groupKey);
    if (!g) return;
    const shuffled = [...g.teams].sort(() => Math.random() - 0.5);
    setPicks(prev => ({ ...prev, [groupKey]: { first_team: shuffled[0].code, second_team: shuffled[1].code, third_team: shuffled[2].code } }));
  };

  const randomAll = () => {
    if (readOnly) return;
    const p: Record<string, GroupPick> = {};
    groups.forEach(g => {
      const s = [...g.teams].sort(() => Math.random() - 0.5);
      p[g.key] = { first_team: s[0].code, second_team: s[1].code, third_team: s[2].code };
    });
    setPicks(p);
  };

  const thirds = useMemo(() => groups.map(g => ({ key: g.key, team: g.teams.find(t => t.code === picks[g.key]?.third_team) })).filter(x => x.team), [groups, picks]);

  const toggleThird = (code: string) => {
    if (readOnly) return;
    setBestThirds(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 8) { toast.error("Máximo 8 terceiros"); return prev; }
      return [...prev, code];
    });
    // clear bracket dependent on thirds
    setBracket({});
  };

  // Build R32 slots from template using picks
  const r32Slots = useMemo(() => {
    return bracketTemplate.map(({ slot, a, b }) => ({
      slot,
      teamA: resolveSlotTeam(a, picks, bestThirds, groups),
      teamB: resolveSlotTeam(b, picks, bestThirds, groups),
    }));
  }, [bracketTemplate, picks, bestThirds, groups]);

  const teamByCode = useMemo(() => {
    const m: Record<string, Team> = {};
    groups.forEach(g => g.teams.forEach(t => { m[t.code] = t; }));
    return m;
  }, [groups]);

  // For each round, compute available pairs from previous round picks (or r32Slots for r16)
  const pickWinner = (round: keyof typeof ROUND_SIZES, slot: number, code: string) => {
    if (readOnly || !code) return;
    setBracket(prev => {
      const next: BracketState = { ...prev, [round]: { ...(prev[round] || {}), [slot]: code } };
      // clear downstream rounds
      const order = ["r16", "qf", "sf", "final", "champion"];
      const idx = order.indexOf(round);
      for (let i = idx + 1; i < order.length; i++) delete next[order[i]];
      return next;
    });
  };

  const getRoundPairs = (round: keyof typeof ROUND_SIZES): { slot: number; a?: Team; b?: Team }[] => {
    if (round === "r16") {
      // pairs of r32 slots
      const pairs: { slot: number; a?: Team; b?: Team }[] = [];
      for (let i = 0; i < r32Slots.length; i += 2) {
        const wA = r32Slots[i] ? winnerOf(r32Slots[i].teamA, r32Slots[i].teamB) : undefined;
        const wB = r32Slots[i + 1] ? winnerOf(r32Slots[i + 1].teamA, r32Slots[i + 1].teamB) : undefined;
        // r32 winners are NOT auto: actually the bracket template starts at R32 -> R16 means we have 16 pairs going to 16 winners but the template has 16 r32 matches producing 16 winners which pair into 8 R16 matches? Wait, 32 teams produce 16 R16 matches.
        pairs.push({ slot: i / 2, a: wA, b: wB });
      }
      return pairs;
    }
    const prevRound = ({ qf: "r16", sf: "qf", final: "sf", champion: "final" } as const)[round];
    const prevSize = ROUND_SIZES[prevRound];
    const prev = bracket[prevRound] || {};
    const pairs: { slot: number; a?: Team; b?: Team }[] = [];
    for (let i = 0; i < prevSize; i += 2) {
      pairs.push({ slot: i / 2, a: teamByCode[prev[i]], b: teamByCode[prev[i + 1]] });
    }
    return pairs;
  };

  // r32 winners need user selection too (in R16 slot picks)
  const submit = async (draft: boolean) => {
    if (!authed) { toast.error("Faça login para participar"); return; }
    if (!config) return;
    setSubmitting(true);
    try {
      const groupsPayload = groups.map(g => ({ group_key: g.key, ...picks[g.key] }));
      const bracketPayload: { round: string; slot: number; team_code: string }[] = [];
      Object.entries(bracket).forEach(([round, slots]) => {
        Object.entries(slots).forEach(([slot, code]) => {
          bracketPayload.push({ round, slot: Number(slot), team_code: code });
        });
      });
      const { data, error } = await supabase.functions.invoke("submit-bolao", {
        body: { tag, email: authed.email, accountId: authed.account_id, groups: groupsPayload, bestThirds, bracket: bracketPayload, draft },
      });
      if (error) throw error;
      if (data?.error) {
        const msgs: Record<string, string> = {
          deadline_passed: "Prazo de envio encerrado",
          already_submitted: "Você já enviou seu palpite",
          need_8_thirds: "Selecione 8 melhores terceiros",
          incomplete_groups: "Preencha todos os grupos",
          incomplete_bracket: "Complete o mata-mata",
          user_not_found: "Faça login para participar",
        };
        toast.error(msgs[data.error] || data.error);
        return;
      }
      toast.success(draft ? "Rascunho salvo" : "Palpite enviado! Boa sorte 🍀");
      if (!draft) {
        setEntry((e: any) => ({ ...(e || {}), status: "submitted" }));
      }
    } catch (err: any) {
      toast.error("Erro ao enviar palpite");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-6xl my-4 mx-2 rounded-2xl flex flex-col overflow-hidden" style={{ background: bg, border: `1px solid ${accent}55` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${accent}33`, background: `linear-gradient(135deg, ${accent}22, transparent)` }}>
          <div className="flex items-center gap-3">
            <Trophy size={22} style={{ color: accent }} />
            <div>
              <div className="font-bold text-lg" style={{ color: accent }}>{config?.name || "Bolão da Copa"}</div>
              {config?.submission_deadline && (
                <div className="text-xs" style={{ color: muted }}>
                  {deadlinePassed ? "Prazo encerrado" : `Prazo: ${new Date(config.submission_deadline).toLocaleString("pt-BR")}`}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:opacity-80" style={{ background: `${accent}22`, color: accent }}>
            <X size={18} />
          </button>
        </div>

        {!authed && (
          <div className="p-6 text-center" style={{ color: muted }}>
            Faça login na aba "Minhas apostas" para participar do bolão.
          </div>
        )}

        {authed && loading && (
          <div className="flex-1 flex items-center justify-center p-12" style={{ color: muted }}>
            <Loader2 size={32} className="animate-spin" />
          </div>
        )}

        {authed && !loading && config && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 border-b" style={{ borderColor: `${accent}22` }}>
              {([["groups", `Grupos (${groupsFilled}/${groups.length})`], ["classification", `Classificação (${bestThirds.length}/8)`], ["bracket", "Mata-mata"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-t-lg text-sm font-medium transition"
                  style={{ background: tab === k ? cardBg : "transparent", color: tab === k ? text : muted, borderBottom: tab === k ? `2px solid ${accent}` : "2px solid transparent" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4" style={{ color: text }}>
              {isLocked && (
                <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: `${accent}22`, color: accent }}>
                  <CheckCircle2 size={18} /> Palpite enviado. Boa sorte!
                  {entry?.score > 0 && <span className="ml-auto font-bold">{entry.score} pts</span>}
                </div>
              )}
              {tab === "groups" && (
                <>
                  {!readOnly && (
                    <div className="mb-3 flex justify-end">
                      <button onClick={randomAll} className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:opacity-80" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                        <Shuffle size={12} /> Sorteio aleatório (todos)
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groups.map(g => {
                      const p = picks[g.key] || { first_team: "", second_team: "", third_team: "" };
                      return (
                        <div key={g.key} className="rounded-xl p-3" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold" style={{ color: accent }}>Grupo {g.key}</div>
                            <div className="text-[10px] flex gap-3" style={{ color: muted }}>
                              <span>1º</span><span>2º</span><span>3º</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {g.teams.map(t => (
                              <div key={t.code} className="flex items-center justify-between gap-2 p-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.03)" }}>
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-lg leading-none">{t.flag}</span>
                                  <span className="text-sm truncate">{t.name}</span>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  {(["first_team", "second_team", "third_team"] as const).map(pos => {
                                    const checked = p[pos] === t.code;
                                    return (
                                      <button key={pos} onClick={() => setPosition(g.key, pos, t.code)} disabled={readOnly}
                                        className="w-5 h-5 rounded-full border-2 transition"
                                        style={{ borderColor: checked ? accent : `${accent}66`, background: checked ? accent : "transparent" }}
                                        aria-label={pos} />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          {!readOnly && (
                            <button onClick={() => randomGroup(g.key)} className="mt-2 w-full text-xs py-1.5 rounded-md flex items-center justify-center gap-1.5 hover:opacity-80" style={{ background: "#16a34a22", color: "#22c55e", border: "1px solid #22c55e55" }}>
                              <Shuffle size={12} /> Sorteio aleatório
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {tab === "classification" && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-bold mb-2" style={{ color: accent }}>Classificados diretos (1º + 2º)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {groups.flatMap(g => {
                        const p = picks[g.key];
                        if (!p) return [];
                        return [["1º "+g.key, p.first_team], ["2º "+g.key, p.second_team]] as const;
                      }).map(([label, code]) => {
                        const t = teamByCode[code as string];
                        return (
                          <div key={label} className="p-2 rounded-md text-sm flex items-center gap-2" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                            <span className="text-xs font-bold" style={{ color: muted }}>{label}</span>
                            {t ? <><span>{t.flag}</span><span className="truncate">{t.name}</span></> : <span className="text-xs" style={{ color: muted }}>—</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold mb-2" style={{ color: accent }}>Escolha 8 melhores terceiros ({bestThirds.length}/8)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {thirds.map(({ key, team }) => team && (
                        <button key={team.code} onClick={() => toggleThird(team.code)} disabled={readOnly}
                          className="p-2 rounded-md text-sm flex items-center gap-2 transition"
                          style={{ background: bestThirds.includes(team.code) ? `${accent}33` : cardBg, border: `1px solid ${bestThirds.includes(team.code) ? accent : `${accent}33`}` }}>
                          <span className="text-xs font-bold" style={{ color: muted }}>3º {key}</span>
                          <span>{team.flag}</span>
                          <span className="truncate text-left flex-1">{team.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "bracket" && (
                <div className="space-y-6">
                  {/* R32: user picks winner of each of the 16 R32 matches; result goes to R16 */}
                  <BracketRound title="16-avos (32 → 16)" pairs={r32Slots.map(s => ({ slot: s.slot, a: s.teamA, b: s.teamB }))} picks={bracket.r16 || {}} onPick={(slot, code) => pickWinner("r16", slot, code)} accent={accent} cardBg={cardBg} muted={muted} disabled={readOnly} />
                  <BracketRound title="Oitavas (16 → 8)" pairs={getRoundPairs("qf")} picks={bracket.qf || {}} onPick={(slot, code) => pickWinner("qf", slot, code)} accent={accent} cardBg={cardBg} muted={muted} disabled={readOnly} />
                  <BracketRound title="Quartas (8 → 4)" pairs={getRoundPairs("sf")} picks={bracket.sf || {}} onPick={(slot, code) => pickWinner("sf", slot, code)} accent={accent} cardBg={cardBg} muted={muted} disabled={readOnly} />
                  <BracketRound title="Semifinal (4 → 2)" pairs={getRoundPairs("final")} picks={bracket.final || {}} onPick={(slot, code) => pickWinner("final", slot, code)} accent={accent} cardBg={cardBg} muted={muted} disabled={readOnly} />
                  <BracketRound title="Final" pairs={getRoundPairs("champion")} picks={bracket.champion || {}} onPick={(slot, code) => pickWinner("champion", slot, code)} accent={accent} cardBg={cardBg} muted={muted} disabled={readOnly} />
                  {bracket.champion?.[0] && (
                    <div className="p-4 rounded-xl text-center" style={{ background: `linear-gradient(135deg, ${accent}44, ${accent}11)`, border: `2px solid ${accent}` }}>
                      <Trophy className="inline" size={32} style={{ color: accent }} />
                      <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: muted }}>Campeão</div>
                      <div className="text-xl font-bold" style={{ color: accent }}>
                        {teamByCode[bracket.champion[0]]?.flag} {teamByCode[bracket.champion[0]]?.name}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!readOnly && (
              <div className="p-3 border-t flex gap-2 justify-end" style={{ borderColor: `${accent}33`, background: cardBg }}>
                <button onClick={() => submit(true)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm hover:opacity-80 disabled:opacity-50" style={{ background: `${muted}22`, color: text }}>
                  Salvar rascunho
                </button>
                <button onClick={() => submit(false)} disabled={submitting} className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-80 disabled:opacity-50" style={{ background: accent, color: "#1a1404" }}>
                  {submitting ? "Enviando…" : "Enviar palpite"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function resolveSlotTeam(spec: string, picks: Record<string, GroupPick>, bestThirds: string[], groups: Group[]): Team | undefined {
  // spec like "1A", "2B", "3C"
  const pos = spec[0];
  const key = spec.slice(1);
  const p = picks[key];
  if (!p) return undefined;
  let code = "";
  if (pos === "1") code = p.first_team;
  else if (pos === "2") code = p.second_team;
  else if (pos === "3") {
    // only if this third is among bestThirds
    if (bestThirds.includes(p.third_team)) code = p.third_team;
  }
  if (!code) return undefined;
  for (const g of groups) {
    const t = g.teams.find(x => x.code === code);
    if (t) return t;
  }
  return undefined;
}

function winnerOf(_a?: Team, _b?: Team): Team | undefined { return undefined; }

function BracketRound({ title, pairs, picks, onPick, accent, cardBg, muted, disabled }: {
  title: string;
  pairs: { slot: number; a?: Team; b?: Team }[];
  picks: Record<number, string>;
  onPick: (slot: number, code: string) => void;
  accent: string; cardBg: string; muted: string; disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-sm font-bold mb-2" style={{ color: accent }}>{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {pairs.map(({ slot, a, b }) => {
          const selected = picks[slot];
          const pick = (code?: string) => code && !disabled && onPick(slot, code);
          return (
            <div key={slot} className="rounded-lg p-2 space-y-1" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
              {[a, b].map((t, i) => {
                const isWinner = selected && t && selected === t.code;
                return (
                  <button key={i} onClick={() => pick(t?.code)} disabled={!t || disabled}
                    className="w-full text-left p-2 rounded-md text-sm flex items-center gap-2 transition disabled:opacity-40"
                    style={{ background: isWinner ? `${accent}33` : "rgba(255,255,255,0.04)", border: isWinner ? `1px solid ${accent}` : "1px solid transparent" }}>
                    {t ? <><span>{t.flag}</span><span className="truncate">{t.name}</span></> : <span style={{ color: muted }}>—</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
