import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trophy, Save, ChevronDown, ChevronRight, Eye, Trash2, Share2 } from "lucide-react";

interface Props { ownerId: string }

type Team = { code: string; name: string; flag?: string };
type Group = { key: string; teams: Team[] };

interface Prize { label: string; value: string; highlight?: boolean }
interface BolaoConfig {
  id: string; owner_id: string; tag: string; name: string;
  submission_deadline: string | null;
  submissions_open_at: string | null;
  is_active: boolean;
  ranking_visible: boolean;
  scoring: any;
  groups: Group[];
  bracket_template: any;
  official_results: any;
  page_config: any;
  ghost_ranking: Array<{ name: string; account_id: string; score: number }>;
}

interface Entry {
  id: string; user_name: string; user_email: string; account_id: string;
  status: string; submitted_at: string | null; score: number; score_breakdown: any;
  best_thirds: string[];
}

const ROUNDS = [
  { k: "r16", label: "Oitavas", size: 16 },
  { k: "qf", label: "Quartas", size: 8 },
  { k: "sf", label: "Semis", size: 4 },
  { k: "final", label: "Final", size: 2 },
  { k: "champion", label: "Campeão", size: 1 },
] as const;

const BREAKDOWN_LABELS: Record<string, string> = {
  qualified_group: "Classificados",
  exact_group_position: "Posição exata",
  best_third: "Melhores 3º",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semis",
  finalist: "Finalistas",
  champion: "Campeão",
};

export default function BolaoAdminPanel({ ownerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<BolaoConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string>("");
  const [entryDetail, setEntryDetail] = useState<Record<string, { groups: any[]; bracket: any[] }>>({});
  const [editingOfficial, setEditingOfficial] = useState<any>({});
  const [showOfficialEditor, setShowOfficialEditor] = useState(false);

  const config = configs.find(c => c.id === selectedId) || null;

  const load = async () => {
    setLoading(true);
    try {
      const { data: cfgs } = await supabase.from("bolao_configs")
        .select("id, owner_id, tag, name, submission_deadline, submissions_open_at, is_active, ranking_visible, scoring, groups, bracket_template, official_results, page_config, ghost_ranking")
        .eq("owner_id", ownerId).order("created_at", { ascending: false });
      const list = (cfgs || []) as BolaoConfig[];
      setConfigs(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch {
      toast.error("Erro ao carregar bolões");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [ownerId]);

  const loadEntries = async () => {
    if (!selectedId) return;
    const { data } = await supabase.from("bolao_entries")
      .select("id, user_name, user_email, account_id, status, submitted_at, score, score_breakdown, best_thirds")
      .eq("bolao_config_id", selectedId)
      .order("score", { ascending: false });
    setEntries((data || []) as Entry[]);
  };
  useEffect(() => { loadEntries(); setEditingOfficial(config?.official_results || {}); }, [selectedId]);

  const teamByCode = useMemo(() => {
    const m: Record<string, Team> = {};
    config?.groups?.forEach(g => g.teams.forEach(t => { m[t.code] = t; }));
    return m;
  }, [config]);

  const recalculate = async () => {
    if (!selectedId) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-bolao", { body: { bolao_config_id: selectedId } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Pontuação recalculada (${data.updated} palpites)`);
      await loadEntries();
    } catch (e: any) {
      toast.error("Erro ao recalcular: " + (e?.message || ""));
    } finally {
      setScoring(false);
    }
  };

  const saveOfficial = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("bolao_configs")
        .update({ official_results: editingOfficial, updated_at: new Date().toISOString() })
        .eq("id", selectedId);
      if (error) throw error;
      toast.success("Resultados oficiais salvos");
      await load();
    } catch (e: any) {
      toast.error("Erro: " + e?.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEntry = async (id: string) => {
    if (expandedEntry === id) { setExpandedEntry(""); return; }
    setExpandedEntry(id);
    if (!entryDetail[id]) {
      const [{ data: g }, { data: b }] = await Promise.all([
        supabase.from("bolao_entry_groups").select("group_key, first_team, second_team, third_team").eq("entry_id", id),
        supabase.from("bolao_entry_bracket").select("round, slot, team_code").eq("entry_id", id),
      ]);
      setEntryDetail(prev => ({ ...prev, [id]: { groups: g || [], bracket: b || [] } }));
    }
  };

  const deleteEntry = async (entry: Entry) => {
    if (!confirm(`Remover o palpite de ${entry.user_name || entry.user_email || entry.account_id}? Esta ação não pode ser desfeita.`)) return;
    try {
      await supabase.from("bolao_entry_groups").delete().eq("entry_id", entry.id);
      await supabase.from("bolao_entry_bracket").delete().eq("entry_id", entry.id);
      const { error } = await supabase.from("bolao_entries").delete().eq("id", entry.id);
      if (error) throw error;
      toast.success("Palpite removido");
      setEntries(prev => prev.filter(x => x.id !== entry.id));
      if (expandedEntry === entry.id) setExpandedEntry("");
    } catch (e: any) {
      toast.error("Erro ao remover: " + (e?.message || ""));
    }
  };

  const setOfficialGroup = (key: string, pos: "first" | "second" | "third", code: string) => {
    setEditingOfficial((prev: any) => {
      const groups = { ...(prev.groups || {}) };
      const cur = { ...(groups[key] || {}) };
      cur[pos] = code;
      // remove duplicates within same group
      (["first", "second", "third"] as const).forEach(p => { if (p !== pos && cur[p] === code) cur[p] = ""; });
      groups[key] = cur;
      return { ...prev, groups };
    });
  };

  const setOfficialThirds = (codes: string[]) => {
    setEditingOfficial((prev: any) => ({ ...prev, best_thirds: codes }));
  };

  const toggleBracketTeam = (round: string, code: string) => {
    setEditingOfficial((prev: any) => {
      const bracket = { ...(prev.bracket || {}) };
      const arr: string[] = Array.isArray(bracket[round]) ? [...bracket[round]] : Object.values(bracket[round] || {}) as string[];
      const idx = arr.indexOf(code);
      const cap = ROUNDS.find(r => r.k === round)?.size || 99;
      if (idx >= 0) arr.splice(idx, 1);
      else if (arr.length < cap) arr.push(code);
      else { toast.error(`Máximo ${cap} times nesta fase`); return prev; }
      bracket[round] = arr;
      return { ...prev, bracket };
    });
  };

  const exportCSV = () => {
    if (!entries.length) return;
    const rows = [["Nome", "Account", "Email", "Status", "Pontos"]];
    entries.forEach(e => rows.push([e.user_name, e.account_id, e.user_email, e.status, String(e.score)]));
    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bolao-${config?.tag}-ranking.csv`; a.click();
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;
  if (!configs.length) return <div className="p-6 text-center text-muted-foreground">Nenhum bolão encontrado. Crie um na configuração da página de apostas.</div>;

  const allTeams = config?.groups?.flatMap(g => g.teams) || [];
  const bracketTeams = (round: string): string[] => {
    const v = editingOfficial?.bracket?.[round];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return Object.values(v) as string[];
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Trophy className="text-primary" />
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="px-3 py-2 rounded-lg bg-muted text-sm">
          {configs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.tag})</option>)}
        </select>
        <button onClick={recalculate} disabled={scoring}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50">
          {scoring ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Recalcular pontuações
        </button>
        <button onClick={exportCSV} className="px-3 py-2 rounded-lg bg-muted text-sm">Exportar CSV</button>
        {config && (
          <button
            onClick={async () => {
              const url = `${window.location.origin}/odds=${config.tag}?bolao=1`;
              const text = `Participe do ${config.name}! Faça seu palpite: ${url}`;
              try {
                if (navigator.share) {
                  await navigator.share({ title: config.name, text, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado!");
                }
              } catch (e: any) {
                if (e?.name !== "AbortError") {
                  try { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
                  catch { toast.error("Não foi possível compartilhar"); }
                }
              }
            }}
            className="px-3 py-2 rounded-lg bg-muted text-sm flex items-center gap-2">
            <Share2 size={14} /> Compartilhar bolão
          </button>
        )}
        <button onClick={() => setShowOfficialEditor(v => !v)} className="px-3 py-2 rounded-lg bg-muted text-sm flex items-center gap-1">
          {showOfficialEditor ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Resultados oficiais
        </button>
      </div>

      {config && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <h3 className="font-bold text-sm">Abertura das inscrições</h3>
          <p className="text-xs text-muted-foreground">
            Quando o bolão começa a aceitar inscrições. Antes dessa data, os usuários veem uma contagem regressiva. Deixe em branco para abrir imediatamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={(() => {
                if (!config.submissions_open_at) return "";
                const d = new Date(config.submissions_open_at);
                const tz = d.getTimezoneOffset() * 60000;
                return new Date(d.getTime() - tz).toISOString().slice(0, 16);
              })()}
              onChange={(e) => {
                const v = e.target.value;
                const iso = v ? new Date(v).toISOString() : null;
                setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, submissions_open_at: iso } : c));
              }}
              className="px-3 py-2 rounded-lg bg-muted text-sm"
            />
            <button
              onClick={async () => {
                setSaving(true);
                const { error } = await supabase.from("bolao_configs")
                  .update({ submissions_open_at: config.submissions_open_at })
                  .eq("id", config.id);
                setSaving(false);
                if (error) toast.error("Erro ao salvar");
                else toast.success("Abertura atualizada");
              }}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
            </button>
            {config.submissions_open_at && (
              <button
                onClick={async () => {
                  setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, submissions_open_at: null } : c));
                  const { error } = await supabase.from("bolao_configs")
                    .update({ submissions_open_at: null })
                    .eq("id", config.id);
                  if (error) toast.error("Erro ao limpar");
                  else toast.success("Inscrições abertas imediatamente");
                }}
                className="px-3 py-2 rounded-lg bg-muted text-sm">
                Limpar
              </button>
            )}
          </div>
          {config.submissions_open_at && (
            <div className="text-xs text-muted-foreground">
              Abre em: {new Date(config.submissions_open_at).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}

      {config && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <h3 className="font-bold text-sm">Visibilidade do ranking</h3>
          <p className="text-xs text-muted-foreground">
            Quando ativado, os participantes veem a aba "Ranking" com o Top 10. Mantenha desativado até liberar os resultados.
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!config.ranking_visible}
              onChange={async (e) => {
                const v = e.target.checked;
                setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ranking_visible: v } : c));
                const { error } = await supabase.from("bolao_configs")
                  .update({ ranking_visible: v }).eq("id", config.id);
                if (error) toast.error("Erro ao atualizar"); else toast.success(v ? "Ranking liberado" : "Ranking ocultado");
              }}
            />
            Mostrar ranking para os participantes
          </label>
        </div>
      )}

      {config && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm">Fantasmas do ranking</h3>
              <p className="text-xs text-muted-foreground">
                Participantes fictícios que aparecem no Top 10 apenas quando o ranking estiver visível. Não afetam pontuação real nem podem ganhar prêmios.
              </p>
            </div>
            <button
              onClick={async () => {
                const next = [...(config.ghost_ranking || []), { name: "", account_id: "", score: 0 }];
                setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
              }}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold whitespace-nowrap">
              + Adicionar
            </button>
          </div>

          {(config.ghost_ranking || []).length > 0 && (
            <div className="space-y-2">
              {(config.ghost_ranking || []).map((g, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={g.name}
                    onChange={(e) => {
                      const next = [...config.ghost_ranking];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
                    }}
                    className="flex-1 min-w-[140px] px-2 py-1.5 rounded bg-background border border-border text-sm"
                  />
                  <input
                    type="text"
                    placeholder="ID"
                    value={g.account_id}
                    onChange={(e) => {
                      const next = [...config.ghost_ranking];
                      next[idx] = { ...next[idx], account_id: e.target.value };
                      setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
                    }}
                    className="w-32 px-2 py-1.5 rounded bg-background border border-border text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Pontos"
                    value={g.score}
                    onChange={(e) => {
                      const next = [...config.ghost_ranking];
                      next[idx] = { ...next[idx], score: Number(e.target.value) || 0 };
                      setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
                    }}
                    className="w-24 px-2 py-1.5 rounded bg-background border border-border text-sm"
                  />
                  <button
                    onClick={() => {
                      const next = config.ghost_ranking.filter((_, i) => i !== idx);
                      setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
                    }}
                    className="p-2 rounded bg-destructive/10 text-destructive hover:bg-destructive/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={async () => {
                const clean = (config.ghost_ranking || [])
                  .filter(g => g.name.trim())
                  .map(g => ({ name: g.name.trim(), account_id: String(g.account_id || "").trim(), score: Number(g.score) || 0 }));
                const { error } = await supabase.from("bolao_configs")
                  .update({ ghost_ranking: clean }).eq("id", config.id);
                if (error) toast.error("Erro ao salvar fantasmas");
                else {
                  toast.success("Fantasmas salvos");
                  setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: clean } : c));
                }
              }}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              <Save className="w-4 h-4 inline mr-1" /> Salvar fantasmas
            </button>
            <button
              onClick={() => {
                const nStr = prompt("Quantos fantasmas gerar?", "10");
                const n = Math.max(1, Math.min(50, Number(nStr) || 0));
                if (!n) return;
                const minStr = prompt("Pontuação mínima?", "50");
                const maxStr = prompt("Pontuação máxima?", "200");
                const min = Number(minStr) || 0;
                const max = Math.max(min, Number(maxStr) || min);
                const NAMES = ["Lucas","Mateus","João","Pedro","Gabriel","Rafael","Bruno","Thiago","Diego","Felipe","Rodrigo","Vinicius","Gustavo","Leonardo","André","Eduardo","Marcelo","Ricardo","Fernando","Daniel","Camila","Juliana","Fernanda","Amanda","Beatriz","Larissa","Mariana","Aline","Patrícia","Renata"];
                const SURN = ["Silva","Souza","Santos","Oliveira","Pereira","Costa","Almeida","Rodrigues","Nunes","Lima","Ferreira","Gomes","Ribeiro","Carvalho","Barbosa","Martins","Araújo","Cardoso","Teixeira","Moreira"];
                const gen = Array.from({ length: n }).map(() => {
                  const first = NAMES[Math.floor(Math.random() * NAMES.length)];
                  const last = SURN[Math.floor(Math.random() * SURN.length)];
                  const acc = String(Math.floor(100000 + Math.random() * 899999));
                  const score = Math.floor(min + Math.random() * (max - min + 1));
                  return { name: `${first} ${last}`, account_id: acc, score };
                });
                const next = [...(config.ghost_ranking || []), ...gen];
                setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, ghost_ranking: next } : c));
              }}
              className="px-3 py-2 rounded-lg bg-muted text-sm">
              Gerar N fantasmas
            </button>
            <span className="text-xs text-muted-foreground ml-auto">
              {(config.ghost_ranking || []).length} fantasma(s) — {config.ranking_visible ? "visíveis no ranking" : "ocultos (ranking desativado)"}
            </span>
          </div>
        </div>
      )}

      {config && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <h3 className="font-bold text-sm">Fechamento das inscrições</h3>
          <p className="text-xs text-muted-foreground">
            Data e hora em que os palpites deixam de ser aceitos. Após essa data, ninguém mais pode enviar ou alterar palpites. Deixe em branco para nunca fechar automaticamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={(() => {
                if (!config.submission_deadline) return "";
                const d = new Date(config.submission_deadline);
                const tz = d.getTimezoneOffset() * 60000;
                return new Date(d.getTime() - tz).toISOString().slice(0, 16);
              })()}
              onChange={(e) => {
                const v = e.target.value;
                const iso = v ? new Date(v).toISOString() : null;
                setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, submission_deadline: iso } : c));
              }}
              className="px-3 py-2 rounded-lg bg-muted text-sm"
            />
            <button
              onClick={async () => {
                setSaving(true);
                const { error } = await supabase.from("bolao_configs")
                  .update({ submission_deadline: config.submission_deadline })
                  .eq("id", config.id);
                setSaving(false);
                if (error) toast.error("Erro ao salvar");
                else toast.success("Fechamento atualizado");
              }}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
            </button>
            {config.submission_deadline && (
              <button
                onClick={async () => {
                  setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, submission_deadline: null } : c));
                  const { error } = await supabase.from("bolao_configs")
                    .update({ submission_deadline: null })
                    .eq("id", config.id);
                  if (error) toast.error("Erro ao limpar");
                  else toast.success("Fechamento removido");
                }}
                className="px-3 py-2 rounded-lg bg-muted text-sm">
                Limpar
              </button>
            )}
          </div>
          {config.submission_deadline && (
            <div className="text-xs text-muted-foreground">
              Fecha em: {new Date(config.submission_deadline).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}

      {config && (
        <PrizesEditor
          key={config.id}
          initial={Array.isArray(config.page_config?.prizes) ? config.page_config.prizes : DEFAULT_PRIZES}
          onSave={async (prizes) => {
            const nextPC = { ...(config.page_config || {}), prizes };
            const { error } = await supabase.from("bolao_configs")
              .update({ page_config: nextPC, updated_at: new Date().toISOString() })
              .eq("id", config.id);
            if (error) { toast.error("Erro ao salvar premiação"); return; }
            setConfigs(cs => cs.map(c => c.id === config.id ? { ...c, page_config: nextPC } : c));
            toast.success("Premiação salva");
          }}
        />
      )}



      {showOfficialEditor && config && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Resultados oficiais</h3>
            <div className="flex gap-2">
              <button onClick={() => {
                if (confirm("Desfazer todos os resultados oficiais? Isso limpa grupos, melhores 3º e mata-mata (salve para confirmar).")) {
                  setEditingOfficial({});
                }
              }}
                className="px-3 py-1.5 rounded-lg bg-muted text-sm">
                Desfazer
              </button>
              <button onClick={saveOfficial} disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Grupos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {config.groups.map(g => {
                const off = editingOfficial?.groups?.[g.key] || {};
                return (
                  <div key={g.key} className="rounded-lg bg-muted p-3">
                    <div className="font-bold mb-2">Grupo {g.key}</div>
                    {g.teams.map(t => (
                      <div key={t.code} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm truncate">{t.name}</span>
                        <div className="flex gap-1">
                          {(["first", "second", "third"] as const).map(pos => (
                            <button key={pos} onClick={() => setOfficialGroup(g.key, pos, t.code)}
                              className={`w-6 h-6 rounded-full text-[10px] font-bold border ${off[pos] === t.code ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                              title={pos === "first" ? "1º" : pos === "second" ? "2º" : "3º"}>
                              {pos === "first" ? "1" : pos === "second" ? "2" : "3"}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Melhores 8 terceiros ({(editingOfficial?.best_thirds || []).length}/8)</h4>
            <div className="flex flex-wrap gap-2">
              {config.groups.map(g => {
                const code = editingOfficial?.groups?.[g.key]?.third;
                if (!code) return null;
                const team = g.teams.find(t => t.code === code);
                const selected = (editingOfficial?.best_thirds || []).includes(code);
                return (
                  <button key={g.key} onClick={() => {
                    const cur: string[] = editingOfficial?.best_thirds || [];
                    if (selected) setOfficialThirds(cur.filter(c => c !== code));
                    else if (cur.length < 8) setOfficialThirds([...cur, code]);
                    else toast.error("Máximo 8 terceiros");
                  }}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}>
                    {g.key}: {team?.name || code}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Mata-mata (clique para alternar)</h4>
            {ROUNDS.map(r => {
              const picked = bracketTeams(r.k);
              return (
                <div key={r.k} className="mb-3">
                  <div className="text-xs font-semibold mb-1">{r.label} ({picked.length}/{r.size})</div>
                  <div className="flex flex-wrap gap-1">
                    {allTeams.map(t => {
                      const on = picked.includes(t.code);
                      return (
                        <button key={t.code} onClick={() => toggleBracketTeam(r.k, t.code)}
                          className={`px-2 py-1 rounded text-[10px] border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}>
                          {t.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="font-bold">Ranking de palpites ({entries.length})</h3>
        </div>
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Account</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Pontos</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const expanded = expandedEntry === e.id;
                const detail = entryDetail[e.id];
                return (
                  <>
                    <tr key={e.id} className="border-t border-border hover:bg-muted/40">
                      <td className="p-2 font-mono">{i + 1}</td>
                      <td className="p-2">{e.user_name || "—"}<div className="text-[10px] text-muted-foreground">{e.user_email}</div></td>
                      <td className="p-2 font-mono text-xs">{e.account_id}</td>
                      <td className="p-2"><span className={`text-[10px] px-2 py-0.5 rounded ${e.status === "submitted" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>{e.status}</span></td>
                      <td className="p-2 text-right font-bold">{e.score}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleEntry(e.id)} className="p-1 rounded hover:bg-muted" title="Ver detalhes">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => deleteEntry(e)} className="p-1 rounded hover:bg-destructive/20 text-destructive" title="Remover palpite">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={e.id + "_d"} className="bg-muted/20">
                        <td colSpan={6} className="p-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            {Object.entries(e.score_breakdown || {}).map(([k, v]) => (
                              <div key={k} className="bg-card rounded p-2 text-xs">
                                <div className="text-muted-foreground">{BREAKDOWN_LABELS[k] || k}</div>
                                <div className="font-bold text-base">{v as number} pts</div>
                              </div>
                            ))}
                          </div>
                          {detail ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-semibold mb-1 text-muted-foreground">Grupos</div>
                                <div className="space-y-1">
                                  {detail.groups.map(g => {
                                    const off = config?.official_results?.groups?.[g.group_key];
                                    const cell = (pos: "first" | "second" | "third", val: string) => {
                                      const ok = off?.[pos] && off[pos] === val;
                                      return <span className={`px-1 ${ok ? "text-green-400 font-semibold" : ""}`}>{teamByCode[val]?.name || val || "—"}</span>;
                                    };
                                    return (
                                      <div key={g.group_key} className="text-xs flex gap-2">
                                        <span className="font-bold w-6">{g.group_key}</span>
                                        {cell("first", g.first_team)}<span>·</span>{cell("second", g.second_team)}<span>·</span>{cell("third", g.third_team)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold mb-1 text-muted-foreground">Mata-mata</div>
                                {ROUNDS.map(r => {
                                  const picks = detail.bracket.filter(b => b.round === r.k).map(b => b.team_code);
                                  const offRound = (() => {
                                    const v = config?.official_results?.bracket?.[r.k];
                                    return Array.isArray(v) ? v : Object.values(v || {});
                                  })();
                                  return (
                                    <div key={r.k} className="text-xs mb-1">
                                      <span className="font-bold">{r.label}: </span>
                                      {picks.map((c, idx) => (
                                        <span key={idx} className={`inline-block px-1 ${offRound.includes(c) ? "text-green-400 font-semibold" : ""}`}>{teamByCode[c]?.name || c}{idx < picks.length - 1 ? "," : ""}</span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : <div className="text-xs text-muted-foreground">Carregando…</div>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!entries.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum palpite enviado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_PRIZES: Prize[] = [
  { label: "🥇 1º Lugar", value: "R$ 2.000", highlight: true },
  { label: "🥈 2º Lugar", value: "R$ 1.200", highlight: true },
  { label: "🥉 3º Lugar", value: "R$ 700", highlight: true },
  { label: "4º Lugar", value: "R$ 400" },
  { label: "5º Lugar", value: "R$ 250" },
  { label: "6º ao 10º Lugar", value: "R$ 90 cada" },
];

function PrizesEditor({ initial, onSave }: { initial: Prize[]; onSave: (p: Prize[]) => Promise<void> }) {
  const [prizes, setPrizes] = useState<Prize[]>(initial);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Prize>) =>
    setPrizes(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const remove = (i: number) => setPrizes(p => p.filter((_, idx) => idx !== i));
  const add = () => setPrizes(p => [...p, { label: `${p.length + 1}º Lugar`, value: "R$ 0", highlight: false }]);
  const move = (i: number, dir: -1 | 1) => {
    setPrizes(p => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Premiação</h3>
          <p className="text-xs text-muted-foreground">Exibida na aba "Regras" do bolão para os participantes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrizes(DEFAULT_PRIZES)} className="px-3 py-1.5 rounded-lg bg-muted text-xs">Restaurar padrão</button>
          <button onClick={add} className="px-3 py-1.5 rounded-lg bg-muted text-xs">+ Adicionar</button>
          <button onClick={async () => { setSaving(true); await onSave(prizes); setSaving(false); }} disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {prizes.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(i, -1)} className="text-xs px-1 hover:text-primary" disabled={i === 0}>▲</button>
              <button onClick={() => move(i, 1)} className="text-xs px-1 hover:text-primary" disabled={i === prizes.length - 1}>▼</button>
            </div>
            <input value={p.label} onChange={e => update(i, { label: e.target.value })}
              placeholder="Posição (ex: 🥇 1º Lugar)"
              className="flex-1 min-w-[180px] px-2 py-1.5 rounded bg-background border border-border text-sm" />
            <input value={p.value} onChange={e => update(i, { value: e.target.value })}
              placeholder="Prêmio (ex: R$ 2.000)"
              className="w-40 px-2 py-1.5 rounded bg-background border border-border text-sm" />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!p.highlight} onChange={e => update(i, { highlight: e.target.checked })} />
              Destaque
            </label>
            <button onClick={() => remove(i)} className="px-2 py-1.5 rounded bg-destructive/20 text-destructive text-xs">Remover</button>
          </div>
        ))}
        {!prizes.length && <div className="text-xs text-muted-foreground p-2">Nenhum prêmio configurado.</div>}
      </div>
    </div>
  );
}
