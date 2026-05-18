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
    const eventId = String(body?.eventId || "").trim();
    const outcomeId = String(body?.outcomeId || "").trim();
    const amount = Number(body?.amount);

    if (!tag || !email || !accountId || !eventId || !outcomeId) {
      return new Response(JSON.stringify({ success: false, error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return new Response(JSON.stringify({ success: false, error: "invalid_amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: cfg } = await supabase
      .from("bets_configs")
      .select("owner_id, is_active")
      .eq("tag", tag)
      .maybeSingle();
    if (!cfg || !cfg.is_active) {
      return new Response(JSON.stringify({ success: false, error: "page_unavailable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("place_bet", {
      p_owner_id: cfg.owner_id,
      p_email: email,
      p_account_id: accountId,
      p_event_id: eventId,
      p_outcome_id: outcomeId,
      p_amount: Math.floor(amount),
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("place-bet error", err);
    return new Response(JSON.stringify({ success: false, error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
