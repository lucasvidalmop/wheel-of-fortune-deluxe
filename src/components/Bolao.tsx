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

const FlagImg = ({ code, size = 20, fill = false }: { code?: string; size?: number; fill?: boolean }) => {
  const iso = code ? CODE_TO_ISO2[code] : undefined;
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/w80/${iso}.png`}
      srcSet={`https://flagcdn.com/w160/${iso}.png 2x`}
      width={size}
      height={fill ? size : Math.round(size * 0.75)}
      alt={code}
      loading="lazy"
      style={{
        display: "block",
        borderRadius: fill ? 9999 : 2,
        objectFit: "cover",
        width: size,
        height: fill ? size : Math.round(size * 0.75),
        boxShadow: fill ? "none" : "0 0 0 1px rgba(255,255,255,0.08)",
      }}
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
  const [tab, setTab] = useState<"groups" | "bracket" | "rules" | "ranking">("groups");
  const [config, setConfig] = useState<any>(null);
  const [entry, setEntry] = useState<any>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [notStarted, setNotStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [picks, setPicks] = useState<Record<string, GroupPick>>({});
  const [bestThirds, setBestThirds] = useState<string[]>([]);
  const [bracket, setBracket] = useState<BracketState>({});
  const [ranking, setRanking] = useState<Array<{ name: string; account_id: string; score: number }>>([]);
  const [showRanking, setShowRanking] = useState(false);

  const isLocked = !!entry && (entry.status === "submitted" || entry.status === "locked");
  const readOnly = isLocked || deadlinePassed || notStarted;

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
        const deadline = data.config?.submission_deadline ? new Date(data.config.submission_deadline) : null;
        const now = Date.now();
        const notOpen = deadline ? now < deadline.getTime() : false;
        setNotStarted(notOpen);
        if (notOpen && deadline) setTimeLeft(Math.max(0, Math.floor((deadline.getTime() - now) / 1000)));
        // Hydrate picks
        const p: Record<string, GroupPick> = {};
        (data.config.groups as Group[]).forEach(g => { p[g.key] = { first_team: "", second_team: "", third_team: "" }; });
        (data.entryGroups || []).forEach((g: any) => { p[g.group_key] = { first_team: g.first_team, second_team: g.second_team, third_team: g.third_team }; });
        setPicks(p);
        setBestThirds(Array.isArray(data.entry?.best_thirds) ? data.entry.best_thirds : []);
        const br: BracketState = {};
        (data.entryBracket || []).forEach((b: any) => { (br[b.round] ||= {})[b.slot] = b.team_code; });
        setBracket(br);
        setRanking(Array.isArray(data.ranking) ? data.ranking : []);
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, tag, authed?.email, authed?.account_id]);

  // Countdown timer when bolão hasn't opened yet
  useEffect(() => {
    if (!notStarted || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [notStarted, timeLeft]);

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

  // Auto-select the 8 "best thirds" from filled groups (first 8 in group order — A..L).
  // Mirrors the GE-style simulator: user doesn't manually pick thirds; bracket is built automatically.
  useEffect(() => {
    const auto = groups
      .map(g => picks[g.key]?.third_team)
      .filter((c): c is string => !!c)
      .slice(0, 8);
    setBestThirds(prev => (prev.length === auto.length && prev.every((c, i) => c === auto[i]) ? prev : auto));
    // bracket is recomputed from r32Slots; clear stored picks only if thirds set changed materially
  }, [picks, groups]);

  // Build R32 slots from template using picks.
  // Special handling for "3X" specs: there are exactly 8 such slots in the template,
  // and exactly 8 best-thirds chosen by the user. Match preferred 3X when that group's
  // third was selected; fill remaining 3X slots with leftover best-thirds in order.
  const r32Slots = useMemo(() => {
    // First pass: resolve all non-third specs and tentatively resolve 3X
    const thirdSlots: number[] = [];
    const used = new Set<string>();
    const tentative = bracketTemplate.map(({ slot, a, b }) => {
      const resolve = (spec: string, side: "a" | "b") => {
        if (spec[0] === "3") {
          const groupKey = spec.slice(1);
          const p = picks[groupKey];
          const code = p?.third_team;
          if (code && bestThirds.includes(code) && !used.has(code)) {
            used.add(code);
            return groups.flatMap(g => g.teams).find(t => t.code === code);
          }
          thirdSlots.push(slot * 2 + (side === "a" ? 0 : 1));
          return undefined;
        }
        const team = resolveSlotTeam(spec, picks, bestThirds, groups);
        if (team) used.add(team.code);
        return team;
      };
      return { slot, teamA: resolve(a, "a"), teamB: resolve(b, "b") };
    });
    // Second pass: fill empty 3X slots with leftover best-thirds in user-pick order
    const leftover = bestThirds.filter(c => !used.has(c));
    let li = 0;
    for (const flat of thirdSlots) {
      if (li >= leftover.length) break;
      const slotIdx = Math.floor(flat / 2);
      const side = flat % 2 === 0 ? "teamA" : "teamB";
      const code = leftover[li++];
      if (used.has(code)) continue;
      used.add(code);
      const team = groups.flatMap(g => g.teams).find(t => t.code === code);
      (tentative[slotIdx] as any)[side] = team;
    }
    return tentative;
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
      const order = ["r16", "qf", "sf", "final", "champion"] as const;
      const startIdx = order.indexOf(round as any);
      // Deep-clone each round map immutably
      const next: BracketState = {};
      for (const r of order) next[r] = { ...(prev[r] || {}) };

      // 1) Cascade-clear the OLD winner at this slot from all downstream rounds
      const oldCode = prev[round]?.[slot];
      if (oldCode && oldCode !== code) {
        let cs = slot;
        for (let i = startIdx; i < order.length; i++) {
          const r = order[i];
          if (next[r]?.[cs] === oldCode) {
            delete next[r]![cs];
            cs = Math.floor(cs / 2);
          } else {
            break;
          }
        }
      }

      // 2) Set the new winner at the picked slot
      next[round] = { ...next[round], [slot]: code };

      // 3) Remove `code` from any OTHER slot in current and downstream rounds
      //    (a team can only progress in one branch). Cascade-clear those
      //    duplicates' parents too.
      for (let i = startIdx; i < order.length; i++) {
        const r = order[i];
        const legitSlot = slot >> (i - startIdx); // path of the new pick
        for (const sKey of Object.keys(next[r] || {})) {
          const s = Number(sKey);
          if (next[r]![s] === code && s !== legitSlot) {
            // delete this duplicate AND cascade-clear its own parents containing code
            let cs = s;
            for (let j = i; j < order.length; j++) {
              const r2 = order[j];
              if (next[r2]?.[cs] === code && (j !== startIdx || cs !== slot)) {
                // never delete the slot we just set
                if (!(r2 === round && cs === slot)) {
                  next[r2] = { ...next[r2] };
                  delete next[r2]![cs];
                }
                cs = Math.floor(cs / 2);
              } else {
                break;
              }
            }
          }
        }
      }

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
            <Trophy size={22} className="lucide lucide-trophy bg-transparent text-yellow-500" />
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

        {notStarted && config?.submission_deadline && (
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-center gap-4 text-center shrink-0" style={{ borderColor: `${accent}22`, background: `linear-gradient(135deg, ${accent}11, transparent)` }}>
            <div className="flex items-center gap-2" style={{ color: text }}>
              <Trophy size={18} style={{ color: accent }} />
              <div className="text-sm font-bold">Inscrições em breve</div>
            </div>
            <div className="flex gap-2">
              {(() => {
                const d = Math.floor(timeLeft / 86400);
                const h = Math.floor((timeLeft % 86400) / 3600);
                const m = Math.floor((timeLeft % 3600) / 60);
                const s = timeLeft % 60;
                const box = (val: number, label: string) => (
                  <div key={label} className="flex flex-col items-center">
                    <div className="text-base font-black tabular-nums px-2 py-1 rounded-md leading-none" style={{ background: cardBg, border: `1px solid ${accent}33`, color: accent }}>
                      {String(val).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: muted }}>{label}</div>
                  </div>
                );
                return [box(d, "dias"), box(h, "horas"), box(m, "min"), box(s, "seg")];
              })()}
            </div>
            <div className="text-[11px]" style={{ color: muted }}>
              Abertura: {new Date(config.submission_deadline).toLocaleString("pt-BR")}
            </div>
          </div>
        )}

        {!authed && !notStarted && (
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
            <div className="flex items-end gap-1 px-4 pt-3 border-b overflow-x-auto" style={{ borderColor: `${accent}22` }}>
              {([["groups", `Grupos (${groupsFilled}/${groups.length})`], ["bracket", "Mata-mata"], ["rules", "Regras"], ["ranking", `Ranking${ranking.length > 0 ? ` (Top ${ranking.length})` : ""}`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap flex items-center gap-1.5"
                  style={{ background: tab === k ? cardBg : "transparent", color: tab === k ? text : muted, borderBottom: tab === k ? `2px solid ${accent}` : "2px solid transparent" }}>
                  {k === "ranking" && <Trophy size={13} />}
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
                          {(() => {
                            const POS_COLORS: Record<string, string> = {
                              first_team: "#facc15",   // gold
                              second_team: "#cbd5e1",  // silver
                              third_team: "#f97316",   // bronze/orange
                            };
                            const POS_LABEL: Record<string, string> = {
                              first_team: "1º",
                              second_team: "2º",
                              third_team: "3º",
                            };
                            const POSITIONS = ["first_team", "second_team", "third_team"] as const;
                            return (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-bold" style={{ color: accent }}>Grupo {g.key}</div>
                                  <div className="flex gap-1.5 shrink-0">
                                    {POSITIONS.map(pos => (
                                      <span key={pos} className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{ background: `${POS_COLORS[pos]}22`, color: POS_COLORS[pos], border: `1px solid ${POS_COLORS[pos]}55` }}>
                                        {POS_LABEL[pos]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {g.teams.map(t => {
                                    const selectedPos = POSITIONS.find(pos => p[pos] === t.code);
                                    const selColor = selectedPos ? POS_COLORS[selectedPos] : null;
                                    const selLabel = selectedPos ? POS_LABEL[selectedPos] : null;
                                    const handleClick = () => {
                                      if (readOnly) return;
                                      if (selectedPos) {
                                        // clicar novamente remove a sele\u00e7\u00e3o deste time
                                        setPicks(prev => {
                                          const cur = prev[g.key] || { first_team: "", second_team: "", third_team: "" };
                                          return { ...prev, [g.key]: { ...cur, [selectedPos]: "" } };
                                        });
                                        return;
                                      }
                                      // pr\u00f3xima posi\u00e7\u00e3o livre por ordem de clique
                                      const nextPos = POSITIONS.find(pos => !p[pos]);
                                      if (!nextPos) return; // grupo j\u00e1 completo
                                      setPosition(g.key, nextPos, t.code);
                                    };
                                    return (
                                      <button
                                        type="button"
                                        key={t.code}
                                        onClick={handleClick}
                                        disabled={readOnly}
                                        className="w-full flex items-center justify-between gap-2 p-2 rounded-md transition text-left hover:opacity-90 disabled:cursor-not-allowed"
                                        style={{
                                          background: selColor ? `${selColor}26` : "rgba(255,255,255,0.03)",
                                          border: selColor ? `1px solid ${selColor}` : "1px solid transparent",
                                          boxShadow: selColor ? `0 0 0 1px ${selColor}33 inset` : "none",
                                        }}
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <FlagImg code={t.code} size={22} />
                                          <span className="text-sm truncate" style={{ color: selColor || undefined, fontWeight: selColor ? 600 : 400 }}>{t.name}</span>
                                        </div>
                                        {selLabel && (
                                          <span className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
                                            style={{ background: selColor!, color: "#0a0a14" }}>
                                            {selLabel}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
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




              {tab === "bracket" && (
                <div className="overflow-x-auto -mx-4 px-4">
                  <div className="mb-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: accent }}>Mata-mata</div>
                    <div className="text-xs" style={{ color: muted }}>Clique nos vencedores de cada confronto.</div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mx-auto py-4" style={{ minWidth: 880 }}>
                    <BracketHalf
                      side="left"
                      r32={r32Slots}
                      bracket={bracket}
                      teamByCode={teamByCode}
                      pickWinner={pickWinner}
                      accent={accent} muted={muted}
                      disabled={readOnly}
                    />
                    <BracketCenter
                      leftFinalist={teamByCode[bracket.final?.[0] || ""]}
                      rightFinalist={teamByCode[bracket.final?.[1] || ""]}
                      champion={teamByCode[bracket.champion?.[0] || ""]}
                      onPickChampion={(code) => pickWinner("champion", 0, code)}
                      accent={accent} muted={muted} text={text} disabled={readOnly}
                    />
                    <BracketHalf
                      side="right"
                      r32={r32Slots}
                      bracket={bracket}
                      teamByCode={teamByCode}
                      pickWinner={pickWinner}
                      accent={accent} muted={muted}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              )}

              {tab === "rules" && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                    <div className="font-bold text-sm mb-3" style={{ color: accent }}>Como funciona</div>
                    <ul className="space-y-2 text-sm" style={{ color: muted }}>
                      <li className="flex gap-2"><span style={{ color: accent }}>1.</span> Preencha a classificação dos 12 grupos (1º, 2º e 3º colocados).</li>
                      <li className="flex gap-2"><span style={{ color: accent }}>2.</span> Os 8 melhores terceiros colocados são definidos automaticamente por ordem de grupos.</li>
                      <li className="flex gap-2"><span style={{ color: accent }}>3.</span> Monte o mata-mata clicando nos vencedores de cada confronto até o campeão.</li>
                      <li className="flex gap-2"><span style={{ color: accent }}>4.</span> Envie seu palpite uma única vez. Após o envio, não é possível alterar.</li>
                      <li className="flex gap-2"><span style={{ color: accent }}>5.</span> A pontuação é calculada automaticamente conforme os resultados oficiais.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                    <div className="font-bold text-sm mb-3" style={{ color: accent }}>Pontuação</div>
                    <div className="space-y-2">
                      {[
                        { label: "Seleção classificada (top 2 ou entre os 8 melhores 3º)", pts: 5 },
                        { label: "Terceiro escolhido entre os 8 melhores reais", pts: 8 },
                        { label: "Posição exata no grupo (1º, 2º ou 3º)", pts: 10 },
                        { label: "Acerto de seleção nas oitavas de final", pts: 10 },
                        { label: "Acerto de seleção nas quartas de final", pts: 15 },
                        { label: "Acerto de seleção na semifinal", pts: 25 },
                        { label: "Acerto de finalista", pts: 40 },
                        { label: "Acerto do campeão", pts: 80 },
                      ].map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md" style={{ background: i % 2 === 0 ? `${accent}0d` : "transparent" }}>
                          <span className="text-sm" style={{ color: text }}>{r.label}</span>
                          <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>+{r.pts} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                    <div className="font-bold text-sm mb-3" style={{ color: accent }}>Premiação</div>
                    <div className="space-y-2">
                      {(Array.isArray((config as any)?.page_config?.prizes) && (config as any).page_config.prizes.length
                        ? (config as any).page_config.prizes
                        : [
                            { label: "🥇 1º Lugar", value: "R$ 2.000", highlight: true },
                            { label: "🥈 2º Lugar", value: "R$ 1.200", highlight: true },
                            { label: "🥉 3º Lugar", value: "R$ 700", highlight: true },
                            { label: "4º Lugar", value: "R$ 400", highlight: false },
                            { label: "5º Lugar", value: "R$ 250", highlight: false },
                            { label: "6º ao 10º Lugar", value: "R$ 90 cada", highlight: false },
                          ]
                      ).map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: p.highlight ? `${accent}18` : i % 2 === 0 ? `${accent}0d` : "transparent", border: p.highlight ? `1px solid ${accent}44` : "1px solid transparent" }}>
                          <span className="text-sm font-semibold" style={{ color: text }}>{p.label}</span>
                          <span className="text-sm font-bold tabular-nums" style={{ color: p.highlight ? accent : muted }}>{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                    <div className="font-bold text-sm mb-2" style={{ color: accent }}>Desempate</div>
                    <p className="text-sm" style={{ color: muted }}>
                      Em caso de empate na pontuação, o critério de desempate é o horário de envio do palpite — quem enviou primeiro fica na frente.
                    </p>
                  </div>
                </div>
              )}

              {tab === "ranking" && (
                <div className="max-w-2xl mx-auto">
                  <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${accent}33` }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${accent}18`, borderBottom: `1px solid ${accent}33` }}>
                      <Trophy size={18} style={{ color: accent }} />
                      <div className="font-bold text-sm" style={{ color: accent }}>Top 10 do bolão</div>
                      <span className="ml-auto text-[11px]" style={{ color: muted }}>{ranking.length} {ranking.length === 1 ? "participante" : "participantes"}</span>
                    </div>
                    {ranking.length === 0 ? (
                      <div className="p-8 text-center text-sm" style={{ color: muted }}>
                        Nenhum palpite enviado ainda. Seja o primeiro!
                      </div>
                    ) : (
                      <ol>
                        {ranking.map((r, i) => {
                          const first = (r.name || "—").trim().split(/\s+/)[0];
                          const id = r.account_id || "";
                          const masked = id.length > 4 ? id.slice(0, -4) + "****" : "****";
                          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
                          const isMe = authed?.account_id && id === authed.account_id;
                          return (
                            <li key={i} className="flex items-center gap-3 px-4 py-3"
                              style={{
                                borderTop: i === 0 ? "none" : `1px solid ${muted}22`,
                                background: isMe ? `${accent}14` : i < 3 ? `${accent}08` : "transparent",
                                color: text,
                              }}>
                              <span className="w-8 text-center text-lg font-bold tabular-nums" style={{ color: i < 3 ? accent : muted }}>
                                {medal || `${i + 1}º`}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate flex items-center gap-2">
                                  {first}
                                  {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: accent, color: "#1a1404" }}>VOCÊ</span>}
                                </div>
                                <div className="font-mono text-[11px]" style={{ color: muted }}>{masked}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg tabular-nums leading-none" style={{ color: accent }}>{r.score}</div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>pts</div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                  <p className="text-xs text-center mt-3" style={{ color: muted }}>
                    Ranking atualizado conforme os resultados oficiais são lançados.
                  </p>
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

// ─── Bracket tree (GE-style) ──────────────────────────────────────────────

function MatchSlot({ team, selected, onClick, disabled, accent, muted, size, mirror, showName = true }: {
  team?: Team; selected?: boolean; onClick?: () => void; disabled?: boolean;
  accent: string; muted: string; size: number; mirror?: boolean; showName?: boolean;
}) {
  const clickable = !!team && !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className="group flex items-center gap-1.5 transition disabled:cursor-default"
      style={{ flexDirection: mirror ? "row-reverse" : "row" }}
    >
      <div
        className="rounded-full flex items-center justify-center shrink-0 transition overflow-hidden"
        style={{
          width: size, height: size,
          border: `2px solid ${selected ? accent : team ? `${muted}66` : `${muted}33`}`,
          background: team ? "rgba(255,255,255,0.04)" : "transparent",
          boxShadow: selected ? `0 0 14px ${accent}99, inset 0 0 8px ${accent}33` : team ? "0 2px 6px rgba(0,0,0,0.3)" : "none",
          opacity: team ? 1 : 0.5,
        }}
      >
        {team ? <FlagImg code={team.code} size={size - 4} fill /> : null}
      </div>
      {showName && team && (
        <span
          className="text-[10px] font-bold tracking-wider uppercase truncate"
          style={{ color: selected ? accent : muted, maxWidth: 44 }}
        >
          {team.code}
        </span>
      )}
    </button>
  );
}

function R32MatchCard({ teamA, teamB, winnerCode, onPick, disabled, accent, muted, mirror }: {
  teamA?: Team; teamB?: Team; winnerCode?: string;
  onPick: (code: string) => void; disabled?: boolean;
  accent: string; muted: string; mirror?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-center gap-1 px-2 rounded-md"
      style={{
        borderRight: mirror ? "none" : `1px solid ${muted}22`,
        borderLeft: mirror ? `1px solid ${muted}22` : "none",
      }}
    >
      {[teamA, teamB].map((t, i) => (
        <MatchSlot
          key={i}
          team={t}
          selected={!!winnerCode && t?.code === winnerCode}
          onClick={t ? () => onPick(t.code) : undefined}
          disabled={disabled}
          accent={accent}
          muted={muted}
          size={30}
          mirror={mirror}
        />
      ))}
    </div>
  );
}

// ─── Recursive bracket tree ─────────────────────────────────────────────────
// Each node displays the winner circle for that exact match slot.
const ROUND_KEY_BY_DEPTH = ["r16", "qf", "sf", "final"] as const;
const NEXT_ROUND_BY_DEPTH = ["qf", "sf", "final", "champion"] as const;
const SLOT_SIZE_BY_DEPTH = [30, 34, 38, 44];
const R32_HEIGHT = 64;
const GAP_BY_DEPTH = [6, 10, 16, 28, 0]; // gap between two children at this depth's parent

type Ctx = {
  r32: { slot: number; teamA?: Team; teamB?: Team }[];
  bracket: BracketState;
  teamByCode: Record<string, Team>;
  pickWinner: (round: any, slot: number, code: string) => void;
  accent: string; muted: string; disabled?: boolean;
};

function BracketSubTree({ depth, slot, mirror, ctx }: {
  depth: 0 | 1 | 2 | 3;
  slot: number;
  mirror: boolean;
  ctx: Ctx;
}) {
  const roundKey = ROUND_KEY_BY_DEPTH[depth];
  const nextKey = NEXT_ROUND_BY_DEPTH[depth];
  const code = ctx.bracket[roundKey]?.[slot];
  const team = code ? ctx.teamByCode[code] : undefined;
  const parentSlot = nextKey === "champion" ? 0 : Math.floor(slot / 2);
  const selected = !!code && ctx.bracket[nextKey]?.[parentSlot] === code;
  const size = SLOT_SIZE_BY_DEPTH[depth];
  const connectorColor = `${ctx.muted}55`;
  const connectorLen = 14;

  if (depth === 0) {
    const m = ctx.r32[slot];
    return (
      <div className="flex items-center" style={{ height: R32_HEIGHT, flexDirection: mirror ? "row-reverse" : "row" }}>
        <R32MatchCard
          teamA={m?.teamA} teamB={m?.teamB}
          winnerCode={ctx.bracket.r16?.[slot]}
          onPick={(code) => ctx.pickWinner("r16", slot, code)}
          disabled={ctx.disabled}
          accent={ctx.accent} muted={ctx.muted} mirror={mirror}
        />
        <div className="flex items-center" style={{ flexDirection: mirror ? "row-reverse" : "row" }}>
          <div style={{ width: connectorLen, height: 1, background: connectorColor }} />
          <MatchSlot
            team={team}
            selected={selected}
            onClick={team ? () => ctx.pickWinner(nextKey, parentSlot, team.code) : undefined}
            disabled={ctx.disabled}
            accent={ctx.accent} muted={ctx.muted}
            size={size} mirror={false} showName={false}
          />
        </div>
      </div>
    );
  }
  const childGap = GAP_BY_DEPTH[depth - 1];

  return (
    <div className="flex items-center" style={{ flexDirection: mirror ? "row-reverse" : "row" }}>
      <div className="flex flex-col justify-center" style={{ gap: childGap }}>
        <BracketSubTree depth={(depth - 1) as any} slot={slot * 2} mirror={mirror} ctx={ctx} />
        <BracketSubTree depth={(depth - 1) as any} slot={slot * 2 + 1} mirror={mirror} ctx={ctx} />
      </div>
      <div className="flex items-center" style={{ flexDirection: mirror ? "row-reverse" : "row" }}>
        <div style={{ width: connectorLen, height: 1, background: connectorColor }} />
        <MatchSlot
          team={team}
          selected={selected}
          onClick={team ? () => ctx.pickWinner(nextKey, parentSlot, team.code) : undefined}
          disabled={ctx.disabled}
          accent={ctx.accent} muted={ctx.muted}
          size={size} mirror={false} showName={false}
        />
      </div>
    </div>
  );
}

function BracketHalf({ side, r32, bracket, teamByCode, pickWinner, accent, muted, disabled }: {
  side: "left" | "right";
  r32: { slot: number; teamA?: Team; teamB?: Team }[];
  bracket: BracketState;
  teamByCode: Record<string, Team>;
  pickWinner: (round: any, slot: number, code: string) => void;
  accent: string; muted: string; disabled?: boolean;
}) {
  const mirror = side === "right";
  const rootSlot = mirror ? 1 : 0;
  const ctx: Ctx = { r32, bracket, teamByCode, pickWinner, accent, muted, disabled };
  return (
    <div className="flex items-center" style={{ justifyContent: mirror ? "flex-start" : "flex-end" }}>
      <BracketSubTree depth={3} slot={rootSlot} mirror={mirror} ctx={ctx} />
    </div>
  );
}

function BracketCenter({ leftFinalist, rightFinalist, champion, onPickChampion, accent, muted, text, disabled }: {
  leftFinalist?: Team; rightFinalist?: Team; champion?: Team;
  onPickChampion: (code: string) => void;
  accent: string; muted: string; text: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-3 md:px-5 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: muted }}>Final</div>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          disabled={!leftFinalist || disabled}
          onClick={() => leftFinalist && onPickChampion(leftFinalist.code)}
          className="rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:cursor-default overflow-hidden"
          style={{
            width: 38, height: 38,
            border: `2px solid ${champion?.code === leftFinalist?.code && champion ? accent : `${muted}55`}`,
            background: "rgba(255,255,255,0.04)",
            boxShadow: champion?.code === leftFinalist?.code && champion ? `0 0 12px ${accent}` : "none",
          }}
        >
          {leftFinalist && <FlagImg code={leftFinalist.code} size={34} fill />}
        </button>
        <div
          className="rounded-full flex items-center justify-center overflow-hidden"
          style={{
            width: 88, height: 88,
            background: champion ? `radial-gradient(circle, ${accent}44, transparent 70%)` : "transparent",
            border: `2px dashed ${champion ? accent : `${muted}55`}`,
          }}
        >
          {champion ? <FlagImg code={champion.code} size={80} fill /> : <Trophy size={40} style={{ color: muted }} />}
        </div>
        <button
          type="button"
          disabled={!rightFinalist || disabled}
          onClick={() => rightFinalist && onPickChampion(rightFinalist.code)}
          className="rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:cursor-default overflow-hidden"
          style={{
            width: 38, height: 38,
            border: `2px solid ${champion?.code === rightFinalist?.code && champion ? accent : `${muted}55`}`,
            background: "rgba(255,255,255,0.04)",
            boxShadow: champion?.code === rightFinalist?.code && champion ? `0 0 12px ${accent}` : "none",
          }}
        >
          {rightFinalist && <FlagImg code={rightFinalist.code} size={34} fill />}
        </button>
      </div>
      <div className="text-center min-h-[32px]">
        {champion ? (
          <>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>Campeão</div>
            <div className="text-sm font-black truncate max-w-[140px]" style={{ color: text }}>{champion.name}</div>
          </>
        ) : (
          <div className="text-[10px]" style={{ color: muted }}>
            {leftFinalist && rightFinalist ? "Clique no campeão" : "Aguardando finalistas"}
          </div>
        )}
      </div>
    </div>
  );
}
