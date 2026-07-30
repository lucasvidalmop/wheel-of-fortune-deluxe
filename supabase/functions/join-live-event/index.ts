import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clientIp = (req: Request) => {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";

    if (!tag || !email || !accountId) return json({ error: "tag, email e account_id são obrigatórios" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev, error: evErr } = await supabase
      .from("gorjeta_events")
      .select("id, owner_id, status, opens_at, closes_at, max_participants, is_active, block_by_ip, require_pix")
      .ilike("tag", tag)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev || !ev.is_active) return json({ error: "Evento não encontrado" }, 404);

    const now = Date.now();
    if (ev.opens_at && now < new Date(ev.opens_at).getTime()) {
      return json({ error: "As inscrições ainda não abriram" }, 400);
    }
    if (ev.closes_at && now > new Date(ev.closes_at).getTime()) {
      return json({ error: "As inscrições estão encerradas" }, 400);
    }
    if (ev.status === "finished") return json({ error: "Este evento já foi finalizado" }, 400);

    // Validate the user against the operator's registered base
    const { data: user } = await supabase
      .from("wheel_users")
      .select("id, name, email, phone, account_id, blacklisted, pix_key")
      .eq("owner_id", ev.owner_id)
      .ilike("email", email)
      .eq("account_id", accountId)
      .maybeSingle();

    if (!user) return json({ error: "Cadastro não encontrado. Verifique o e-mail e o ID da conta." }, 404);
    if (user.blacklisted) return json({ error: "Sua conta não pode participar deste evento." }, 403);
    if (ev.require_pix && !user.pix_key) {
      return json({ error: "Cadastre sua chave PIX antes de participar." }, 400);
    }

    // Already registered? Idempotent response.
    const { data: existing } = await supabase
      .from("gorjeta_event_participants")
      .select("entry_number, has_won")
      .eq("event_id", ev.id)
      .ilike("user_email", email)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, already: true, entryNumber: existing.entry_number });
    }

    const ip = clientIp(req);

    if (ev.block_by_ip && ip) {
      const { data: sameIp } = await supabase
        .from("gorjeta_event_participants")
        .select("id")
        .eq("event_id", ev.id)
        .eq("ip_address", ip)
        .maybeSingle();
      if (sameIp) {
        return json({ error: "Já existe uma inscrição feita a partir desta conexão." }, 409);
      }
    }

    const { count } = await supabase
      .from("gorjeta_event_participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);

    if (ev.max_participants && (count || 0) >= ev.max_participants) {
      return json({ error: "As vagas deste evento foram preenchidas." }, 409);
    }

    const entryNumber = (count || 0) + 1;

    const { error: insErr } = await supabase.from("gorjeta_event_participants").insert({
      event_id: ev.id,
      owner_id: ev.owner_id,
      wheel_user_id: user.id,
      account_id: user.account_id,
      user_email: user.email,
      user_name: user.name,
      user_phone: user.phone || "",
      source: "live",
      entry_number: entryNumber,
      ip_address: ev.block_by_ip ? (ip || null) : null,
    });

    if (insErr) {
      if ((insErr as any).code === "23505") {
        return json({ error: "Inscrição duplicada para este evento." }, 409);
      }
      throw insErr;
    }

    return json({ ok: true, already: false, entryNumber });
  } catch (err) {
    console.error("join-live-event error", err);
    return json({ error: "Falha ao registrar inscrição" }, 500);
  }
});
