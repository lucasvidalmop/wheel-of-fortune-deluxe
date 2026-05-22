import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROUNDS = ["r32", "r16", "qf", "sf", "final", "champion"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const tag = String(body?.tag || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const accountId = String(body?.accountId || "").trim();
    const groups: Array<{ group_key: string; first_team: string; second_team: string; third_team: string }> = body?.groups || [];
    const bestThirds: string[] = Array.isArray(body?.bestThirds) ? body.bestThirds : [];
    const bracket: Array<{ round: string; slot: number; team_code: string }> = body?.bracket || [];
    const draft = !!body?.draft;

    if (!tag || !email || !accountId) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: betsCfg } = await supabase
      .from("bets_configs").select("owner_id").eq("tag", tag).maybeSingle();
    if (!betsCfg) return new Response(JSON.stringify({ error: "config_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: bolao } = await supabase
      .from("bolao_configs").select("id, submission_deadline, groups, bracket_template")
      .eq("owner_id", betsCfg.owner_id).eq("tag", tag).maybeSingle();
    if (!bolao) return new Response(JSON.stringify({ error: "bolao_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const now = new Date();
    const deadline = bolao.submission_deadline ? new Date(bolao.submission_deadline) : null;
    if (deadline && now > deadline) {
      return new Response(JSON.stringify({ error: "deadline_passed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: user } = await supabase
      .from("wheel_users").select("id, name, email, account_id, blacklisted")
      .eq("owner_id", betsCfg.owner_id).ilike("email", email).eq("account_id", accountId).maybeSingle();
    if (!user) return new Response(JSON.stringify({ error: "user_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (user.blacklisted) return new Response(JSON.stringify({ error: "blocked" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate when submitting (not draft)
    if (!draft) {
      if (!Array.isArray(groups) || groups.length !== (bolao.groups as any[]).length) {
        return new Response(JSON.stringify({ error: "incomplete_groups" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const g of groups) {
        if (!g.first_team || !g.second_team || !g.third_team) return new Response(JSON.stringify({ error: "incomplete_group", group: g.group_key }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (g.first_team === g.second_team || g.first_team === g.third_team || g.second_team === g.third_team) return new Response(JSON.stringify({ error: "duplicate_in_group", group: g.group_key }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (bestThirds.length !== 8) return new Response(JSON.stringify({ error: "need_8_thirds" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const expectedCounts: Record<string, number> = { r16: 16, qf: 8, sf: 4, final: 2, champion: 1 };
      for (const [r, n] of Object.entries(expectedCounts)) {
        const got = bracket.filter(b => b.round === r && b.team_code).length;
        if (got !== n) return new Response(JSON.stringify({ error: "incomplete_bracket", round: r }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check existing entry
    const { data: existing } = await supabase
      .from("bolao_entries").select("id, status")
      .eq("bolao_config_id", bolao.id).eq("account_id", accountId).maybeSingle();
    if (existing && (existing.status === "submitted" || existing.status === "locked")) {
      return new Response(JSON.stringify({ error: "already_submitted" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let entryId = existing?.id;
    const entryPayload = {
      owner_id: betsCfg.owner_id,
      bolao_config_id: bolao.id,
      wheel_user_id: user.id,
      account_id: accountId,
      user_email: email,
      user_name: user.name || "",
      status: draft ? "draft" : "submitted",
      best_thirds: bestThirds,
      submitted_at: draft ? null : new Date().toISOString(),
    };
    if (entryId) {
      await supabase.from("bolao_entries").update(entryPayload).eq("id", entryId);
    } else {
      const { data: ins, error: insErr } = await supabase.from("bolao_entries").insert(entryPayload).select("id").single();
      if (insErr || !ins) return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      entryId = ins.id;
    }

    // Replace child rows
    await supabase.from("bolao_entry_groups").delete().eq("entry_id", entryId);
    await supabase.from("bolao_entry_bracket").delete().eq("entry_id", entryId);

    if (groups.length) {
      await supabase.from("bolao_entry_groups").insert(groups.map(g => ({
        entry_id: entryId, owner_id: betsCfg.owner_id,
        group_key: g.group_key, first_team: g.first_team || "", second_team: g.second_team || "", third_team: g.third_team || "",
      })));
    }
    if (bracket.length) {
      await supabase.from("bolao_entry_bracket").insert(bracket.filter(b => ROUNDS.includes(b.round as any)).map(b => ({
        entry_id: entryId, owner_id: betsCfg.owner_id, round: b.round, slot: b.slot, team_code: b.team_code || "",
      })));
    }

    return new Response(JSON.stringify({ ok: true, status: entryPayload.status, entryId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-bolao error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
