import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, maskName } from "../_shared/raffle.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { tag, email, accountId } = await req.json();
    if (!tag || typeof tag !== "string") return json({ error: "tag required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev, error } = await supabase
      .from("raffle_events")
      .select("*")
      .ilike("tag", tag)
      .maybeSingle();
    if (error) throw error;
    if (!ev || !ev.is_active) return json({ found: false });

    const [{ count: approved }, { data: draw }, { data: pool }, { data: ownerConfig }] = await Promise.all([
      supabase.from("raffle_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id).eq("status", "approved"),
      supabase.from("raffle_draws")
        .select("round, winners, executed_at, participants_snapshot_count")
        .eq("event_id", ev.id).eq("superseded", false)
        .order("round", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("raffle_participants")
        .select("public_code, display_name, created_at")
        .eq("event_id", ev.id).eq("status", "approved")
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("wheel_configs").select("config").eq("user_id", ev.owner_id).maybeSingle(),
    ]);
    const raffleFaviconUrl = (ownerConfig?.config as any)?.raffleFaviconUrl || (ownerConfig?.config as any)?.defaultFaviconUrl || "";

    // Fantasmas do evento: entram na lista publica e no contador (nao so na
    // hora do sorteio), senao fica evidente que "surgiram do nada" quando
    // ganham. Mesma regra usada em run-raffle-draw: quantidade + atraso.
    const ghostCount = Number(ev.ghost_count || 0);
    const ghostDelayMinutes = Number(ev.ghost_delay_minutes || 0);
    let ghostEntries: { code: string; name: string }[] = [];
    if (ghostCount > 0) {
      const elapsedMin = (Date.now() - new Date(ev.created_at).getTime()) / 60000;
      if (elapsedMin >= ghostDelayMinutes) {
        const ghostNames: string[] = (ownerConfig?.config as any)?.ghostUsers || [];
        ghostEntries = ghostNames.slice(0, ghostCount).map((name, i) => ({
          code: `GST-${String(i + 1).padStart(5, "0")}`,
          name: maskName(name),
        }));
      }
    }

    let me: Record<string, unknown> | null = null;
    if (email && accountId) {
      const { data: p } = await supabase
        .from("raffle_participants")
        .select("public_code, status, display_name, created_at")
        .eq("event_id", ev.id)
        .ilike("email", String(email).trim())
        .maybeSingle();
      if (p) {
        me = {
          publicCode: p.public_code,
          // Never reveal a silent block to the participant.
          status: p.status === "blocked" ? "approved" : p.status,
          displayName: p.display_name,
          createdAt: p.created_at,
        };
      }
    }

    return json({
      found: true,
      event: {
        id: ev.id,
        ownerId: ev.owner_id,
        tag: ev.tag,
        name: ev.name,
        description: ev.description,
        bannerUrl: ev.banner_url,
        faviconUrl: raffleFaviconUrl,
        rules: ev.rules,
        prizeLabel: ev.prize_label,
        signupUrl: ev.signup_url,
        minParticipants: ev.min_participants,
        maxParticipants: ev.max_participants,
        winnersCount: ev.winners_count,
        opensAt: ev.opens_at,
        closesAt: ev.closes_at,
        drawAt: ev.draw_at,
        status: ev.status,
        theme: ev.theme || {},
        messages: ev.messages || {},
        lockedCount: ev.locked_count,
      },
      approvedCount: (approved || 0) + ghostEntries.length,
      participants: [
        ...(pool || []).map((p) => ({
          code: p.public_code,
          name: maskName(p.display_name || ""),
        })),
        ...ghostEntries,
      ],
      result: draw
        ? {
            round: draw.round,
            executedAt: draw.executed_at,
            totalValid: draw.participants_snapshot_count,
            winners: (draw.winners as any[] || []).map((w) => ({
              name: w.maskedName || maskName(w.name || ""),
              code: w.code,
              position: w.position,
            })),
          }
        : null,
      me,
    });
  } catch (err) {
    console.error("get-raffle-event error", err);
    return json({ error: "Failed to load event" }, 500);
  }
});
