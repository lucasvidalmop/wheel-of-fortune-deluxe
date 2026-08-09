import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, runRaffleDraw } from "../_shared/raffle.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: "Sessão inválida ou expirada." }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { eventId, redrawReason } = await req.json();
    if (!eventId) return json({ error: "eventId required" }, 400);

    const { data: ev } = await admin.from("raffle_events").select("*").eq("id", eventId).maybeSingle();
    if (!ev) return json({ error: "Evento não encontrado" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (ev.owner_id !== userId && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: prevDraw } = await admin
      .from("raffle_draws").select("id").eq("event_id", eventId)
      .eq("superseded", false).limit(1).maybeSingle();

    if (prevDraw && !String(redrawReason || "").trim()) {
      return json({ error: "Informe a justificativa para refazer o sorteio." }, 400);
    }

    const draw = await runRaffleDraw(admin, ev, userId, redrawReason);
    return json({ ok: true, draw });
  } catch (err) {
    console.error("run-raffle-draw error", err);
    const message = err instanceof Error ? err.message : "Falha ao executar o sorteio.";
    return json({ error: message }, 500);
  }
});
