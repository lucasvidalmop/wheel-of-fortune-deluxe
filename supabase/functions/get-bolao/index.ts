import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const tag = String(body?.tag || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const accountId = String(body?.accountId || "").trim();
    if (!tag) {
      return new Response(JSON.stringify({ error: "missing_tag" }), {
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
    if (!betsCfg) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bolao } = await supabase
      .from("bolao_configs")
      .select("id, name, submission_deadline, submissions_open_at, is_active, page_config, scoring, groups, bracket_template, official_results")
      .eq("owner_id", betsCfg.owner_id)
      .eq("tag", tag)
      .maybeSingle();

    if (!bolao) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const deadline = bolao.submission_deadline ? new Date(bolao.submission_deadline) : null;
    const openAt = bolao.submissions_open_at ? new Date(bolao.submissions_open_at) : null;
    const past = deadline ? now > deadline : false;
    const notStarted = openAt ? now < openAt : false;

    // Hide official results before deadline
    const publicConfig = {
      ...bolao,
      official_results: past ? bolao.official_results : {},
    };

    let entry: any = null;
    let entryGroups: any[] = [];
    let entryBracket: any[] = [];

    if (email && accountId) {
      const { data: e } = await supabase
        .from("bolao_entries")
        .select("id, status, submitted_at, best_thirds, score, score_breakdown")
        .eq("bolao_config_id", bolao.id)
        .eq("account_id", accountId)
        .ilike("user_email", email)
        .maybeSingle();
      if (e) {
        entry = e;
        const [{ data: g }, { data: b }] = await Promise.all([
          supabase.from("bolao_entry_groups").select("group_key, first_team, second_team, third_team").eq("entry_id", e.id),
          supabase.from("bolao_entry_bracket").select("round, slot, team_code").eq("entry_id", e.id),
        ]);
        entryGroups = g || [];
        entryBracket = b || [];
      }
    }

    const { data: topRows } = await supabase
      .from("bolao_entries")
      .select("user_name, account_id, score, status, submitted_at")
      .eq("bolao_config_id", bolao.id)
      .in("status", ["submitted", "locked"])
      .order("score", { ascending: false })
      .order("submitted_at", { ascending: true })
      .limit(10);
    const ranking = (topRows || []).map((r: any) => ({
      name: r.user_name || "",
      account_id: r.account_id || "",
      score: r.score || 0,
    }));

    return new Response(JSON.stringify({
      found: true,
      config: publicConfig,
      deadlinePassed: past,
      notStarted,
      entry,
      entryGroups,
      entryBracket,
      ranking,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-bolao error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
