// Recalculates scores for all entries of a bolao_config.
// Admin only — caller must own the bolao_config (owner_id == auth.uid()).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROUNDS = ["r16", "qf", "sf", "final", "champion"] as const;
type Round = typeof ROUNDS[number];

interface OfficialResults {
  groups?: Record<string, { first?: string; second?: string; third?: string }>;
  best_thirds?: string[];
  bracket?: Partial<Record<Round, Record<string, string> | string[]>>;
}

interface Scoring {
  qualified_group: number;
  exact_group_position: number;
  best_third: number;
  r16: number;
  qf: number;
  sf: number;
  finalist: number;
  champion: number;
}

const DEFAULT_SCORING: Scoring = {
  qualified_group: 5, exact_group_position: 10, best_third: 8,
  r16: 10, qf: 15, sf: 25, finalist: 40, champion: 80,
};

function teamsInRound(b: OfficialResults["bracket"], r: Round): string[] {
  const v = b?.[r];
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return Object.values(v).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: userData } = await supabase.auth.getUser(jwt);
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const bolaoConfigId = String(body?.bolao_config_id || "");
    if (!bolaoConfigId) return json({ error: "missing_bolao_config_id" }, 400);

    const { data: cfg } = await supabase.from("bolao_configs")
      .select("id, owner_id, official_results, scoring").eq("id", bolaoConfigId).maybeSingle();
    if (!cfg) return json({ error: "not_found" }, 404);

    // admin check via has_role OR owner match
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (cfg.owner_id !== callerId && !isAdmin) return json({ error: "forbidden" }, 403);

    const official = (cfg.official_results || {}) as OfficialResults;
    const scoring = { ...DEFAULT_SCORING, ...(cfg.scoring || {}) } as Scoring;

    const offGroups = official.groups || {};
    const offThirds = new Set(official.best_thirds || []);
    const qualifiedByGroup: Record<string, Set<string>> = {};
    for (const [k, g] of Object.entries(offGroups)) {
      qualifiedByGroup[k] = new Set([g.first, g.second].filter(Boolean) as string[]);
    }
    const roundSets: Record<Round, Set<string>> = {
      r16: new Set(teamsInRound(official.bracket, "r16")),
      qf: new Set(teamsInRound(official.bracket, "qf")),
      sf: new Set(teamsInRound(official.bracket, "sf")),
      final: new Set(teamsInRound(official.bracket, "final")),
      champion: new Set(teamsInRound(official.bracket, "champion")),
    };

    const { data: entries } = await supabase.from("bolao_entries")
      .select("id").eq("bolao_config_id", bolaoConfigId);

    let updated = 0;
    for (const e of (entries || [])) {
      const [{ data: grps }, { data: brk }, { data: entRow }] = await Promise.all([
        supabase.from("bolao_entry_groups").select("group_key, first_team, second_team, third_team").eq("entry_id", e.id),
        supabase.from("bolao_entry_bracket").select("round, team_code").eq("entry_id", e.id),
        supabase.from("bolao_entries").select("best_thirds").eq("id", e.id).maybeSingle(),
      ]);

      const breakdown = {
        qualified_group: 0, exact_group_position: 0, best_third: 0,
        r16: 0, qf: 0, sf: 0, finalist: 0, champion: 0,
      };

      for (const gp of (grps || [])) {
        const off = offGroups[gp.group_key];
        if (!off) continue;
        const qualSet = qualifiedByGroup[gp.group_key] || new Set();
        // exact position
        if (gp.first_team && gp.first_team === off.first) breakdown.exact_group_position += scoring.exact_group_position;
        if (gp.second_team && gp.second_team === off.second) breakdown.exact_group_position += scoring.exact_group_position;
        if (gp.third_team && gp.third_team === off.third) breakdown.exact_group_position += scoring.exact_group_position;
        // qualified (top 2 or best third)
        for (const code of [gp.first_team, gp.second_team].filter(Boolean) as string[]) {
          if (qualSet.has(code)) breakdown.qualified_group += scoring.qualified_group;
        }
        if (gp.third_team && offThirds.has(gp.third_team)) {
          breakdown.qualified_group += scoring.qualified_group;
          breakdown.best_third += scoring.best_third;
        }
      }

      const userBracketByRound: Record<Round, string[]> = { r16: [], qf: [], sf: [], final: [], champion: [] };
      for (const b of (brk || [])) {
        if ((ROUNDS as readonly string[]).includes(b.round) && b.team_code) {
          userBracketByRound[b.round as Round].push(b.team_code);
        }
      }
      for (const r of ROUNDS) {
        const pts = r === "final" ? scoring.finalist : (scoring as any)[r];
        const seen = new Set<string>();
        for (const code of userBracketByRound[r]) {
          if (seen.has(code)) continue;
          seen.add(code);
          if (roundSets[r].has(code)) {
            if (r === "final") breakdown.finalist += pts;
            else (breakdown as any)[r] += pts;
          }
        }
      }

      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      await supabase.from("bolao_entries").update({
        score: total, score_breakdown: breakdown, updated_at: new Date().toISOString(),
      }).eq("id", e.id);
      updated++;
    }

    return json({ ok: true, updated });
  } catch (err) {
    console.error("score-bolao error", err);
    return json({ error: "internal_error", message: String(err) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
