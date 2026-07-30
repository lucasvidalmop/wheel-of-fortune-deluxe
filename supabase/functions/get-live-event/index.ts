import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const maskName = (name: string) => {
  const first = (name || "").trim().split(/\s+/)[0] || "Participante";
  return first;
};

const maskAccount = (acc: string) => {
  const a = (acc || "").trim();
  if (a.length <= 4) return a;
  return `${a.slice(0, 4)}${"*".repeat(Math.min(4, a.length - 4))}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";

    if (!tag) {
      return new Response(JSON.stringify({ error: "tag required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev, error: evErr } = await supabase
      .from("gorjeta_events")
      .select("id, owner_id, tag, name, description, rules, cover_url, theme, page_config, status, opens_at, closes_at, max_participants, prize_amount, winners_count, is_active")
      .ilike("tag", tag)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev || !ev.is_active) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ count }, { data: results }, refLink] = await Promise.all([
      supabase.from("gorjeta_event_participants").select("id", { count: "exact", head: true }).eq("event_id", ev.id),
      supabase.from("gorjeta_event_results").select("id, user_name, account_id, prize_amount, created_at").eq("event_id", ev.id).eq("is_winner", true).order("created_at", { ascending: true }),
      supabase.from("referral_links").select("code").eq("owner_id", ev.owner_id).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

    let me: { entry_number: number; has_won: boolean } | null = null;
    if (email && accountId) {
      const { data: p } = await supabase
        .from("gorjeta_event_participants")
        .select("entry_number, has_won")
        .eq("event_id", ev.id)
        .ilike("user_email", email)
        .maybeSingle();
      if (p) me = { entry_number: p.entry_number, has_won: p.has_won };
    }

    return new Response(JSON.stringify({
      found: true,
      event: {
        id: ev.id,
        ownerId: ev.owner_id,
        tag: ev.tag,
        name: ev.name,
        description: ev.description,
        rules: ev.rules,
        coverUrl: ev.cover_url,
        theme: ev.theme || {},
        pageConfig: ev.page_config || {},
        status: ev.status,
        opensAt: ev.opens_at,
        closesAt: ev.closes_at,
        maxParticipants: ev.max_participants,
        prizeAmount: Number(ev.prize_amount || 0),
        winnersCount: ev.winners_count,
      },
      participantsCount: count || 0,
      winners: (results || []).map((r) => ({
        id: r.id,
        name: maskName(r.user_name),
        accountId: maskAccount(r.account_id),
        amount: Number(r.prize_amount || 0),
        createdAt: r.created_at,
      })),
      me,
      gorjetaRef: (refLink as any)?.data?.code || "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-live-event error", err);
    return new Response(JSON.stringify({ error: "Failed to load event" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
