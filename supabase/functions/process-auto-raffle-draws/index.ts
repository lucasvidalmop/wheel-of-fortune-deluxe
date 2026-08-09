import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, runRaffleDraw } from "../_shared/raffle.ts";

// Roda a cada minuto (cron): sorteia automaticamente eventos com auto_draw
// ligado cuja data/hora do sorteio (draw_at) ja passou e que ainda nao
// tem um resultado ativo.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date().toISOString();
  const { data: dueEvents, error } = await admin
    .from("raffle_events")
    .select("*")
    .eq("auto_draw", true)
    .neq("status", "finished")
    .not("draw_at", "is", null)
    .lte("draw_at", now);

  if (error) {
    console.error("process-auto-raffle-draws: erro ao buscar eventos", error);
    return json({ error: error.message }, 500);
  }

  const results: { eventId: string; ok: boolean; error?: string }[] = [];

  for (const ev of dueEvents || []) {
    try {
      const { data: prevDraw } = await admin
        .from("raffle_draws").select("id").eq("event_id", ev.id)
        .eq("superseded", false).limit(1).maybeSingle();
      if (prevDraw) {
        results.push({ eventId: ev.id, ok: true });
        continue;
      }
      await runRaffleDraw(admin, ev, ev.owner_id, "");
      results.push({ eventId: ev.id, ok: true });
    } catch (err) {
      console.error(`process-auto-raffle-draws: falha no evento ${ev.id}`, err);
      results.push({ eventId: ev.id, ok: false, error: err instanceof Error ? err.message : "erro desconhecido" });
    }
  }

  return json({ processed: results.length, results });
});
