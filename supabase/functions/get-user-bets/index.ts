import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const tag = String(body?.tag || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const accountId = String(body?.accountId || "").trim();
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

    const { data: cfg } = await supabase
      .from("bets_configs").select("owner_id, id").eq("tag", tag).maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user } = await supabase
      .from("wheel_users")
      .select("id, name, email, account_id, tokens_balance, blacklisted")
      .eq("owner_id", cfg.owner_id)
      .ilike("email", email)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!user) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wagers } = await supabase
      .from("bet_wagers")
      .select("id, event_id, outcome_id, amount_coins, odd_snapshot, payout_mode, status, payout_coins, payout_grant_id, created_at, resolved_at")
      .eq("owner_id", cfg.owner_id)
      .eq("account_id", accountId)
      .ilike("user_email", email)
      .order("created_at", { ascending: false })
      .limit(100);

    const eventIds = Array.from(new Set((wagers || []).map((w: any) => w.event_id)));
    let events: any[] = [];
    if (eventIds.length) {
      const { data: evs } = await supabase
        .from("bet_events")
        .select("id, title, status, winning_outcome_id, payout_mode")
        .in("id", eventIds);
      events = evs || [];
    }

    return new Response(JSON.stringify({
      found: true,
      user: {
        id: user.id, name: user.name, email: user.email,
        account_id: user.account_id, tokens_balance: user.tokens_balance ?? 0,
        blacklisted: !!user.blacklisted,
      },
      wagers: wagers || [],
      events,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-user-bets error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
