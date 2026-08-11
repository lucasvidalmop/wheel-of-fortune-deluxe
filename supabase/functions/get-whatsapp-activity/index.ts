import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { tag, email, accountId } = await req.json();
    if (!tag) return json({ error: "tag required" }, 400);

    const { data: ev } = await admin
      .from("whatsapp_activity_events")
      .select("id, owner_id, name, scope, status, group_name, reminder_signup_url")
      .ilike("tag", tag)
      .maybeSingle();
    if (!ev) return json({ found: false });

    const { data: ownerConfig } = await admin
      .from("wheel_configs").select("config").eq("user_id", ev.owner_id).maybeSingle();
    const faviconUrl = (ownerConfig?.config as any)?.defaultFaviconUrl || "";

    const { data: tiers } = await admin
      .from("whatsapp_activity_tiers")
      .select("id, scope, threshold_messages, reward_type, reward_amount, reward_label")
      .eq("event_id", ev.id)
      .order("threshold_messages", { ascending: true });

    let me: { name: string; wheelUserId: string } | null = null;
    if (email && accountId) {
      const { data: user } = await admin
        .from("wheel_users")
        .select("id, name, email, account_id")
        .eq("owner_id", ev.owner_id)
        .ilike("email", String(email).trim())
        .maybeSingle();
      if (user && String(user.account_id).trim() === String(accountId).trim()) {
        me = { name: user.name, wheelUserId: user.id };
      }
    }

    let myProgress = 0;
    let myUnlocks: { tierId: string; status: string }[] = [];
    if (me) {
      const { data: prog } = await admin
        .from("whatsapp_activity_progress")
        .select("message_count")
        .eq("event_id", ev.id).eq("scope", "individual").eq("wheel_user_id", me.wheelUserId)
        .maybeSingle();
      myProgress = prog?.message_count || 0;

      const { data: unlocks } = await admin
        .from("whatsapp_activity_unlocks")
        .select("tier_id, status")
        .eq("event_id", ev.id).eq("scope", "individual").eq("wheel_user_id", me.wheelUserId);
      myUnlocks = (unlocks || []).map((u) => ({ tierId: u.tier_id, status: u.status }));
    }

    let groupProgress = 0;
    if (ev.scope === "group" || ev.scope === "both") {
      const { data: gp } = await admin
        .from("whatsapp_activity_progress")
        .select("message_count")
        .eq("event_id", ev.id).eq("scope", "group").eq("sender_phone", "")
        .maybeSingle();
      groupProgress = gp?.message_count || 0;
    }

    return json({
      found: true,
      event: {
        name: ev.name, scope: ev.scope, status: ev.status, groupName: ev.group_name, faviconUrl,
        signupUrl: ev.reminder_signup_url || "",
      },
      tiers: (tiers || []).map((t) => ({
        id: t.id, scope: t.scope, threshold: t.threshold_messages,
        rewardType: t.reward_type, rewardAmount: t.reward_amount, rewardLabel: t.reward_label,
      })),
      me: me ? { name: me.name } : null,
      myProgress,
      myUnlocks,
      groupProgress,
    });
  } catch (err) {
    console.error("get-whatsapp-activity error", err);
    return json({ error: "Failed to load" }, 500);
  }
});
