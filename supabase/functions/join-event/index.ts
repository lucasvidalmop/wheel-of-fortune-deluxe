import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const tag = clean(body?.tag, 120);
    const mode = body?.mode === "login" ? "login" : "signup";
    const email = clean(body?.email, 160).toLowerCase();
    const accountId = clean(body?.account_id, 60);
    const name = clean(body?.name, 120);
    const phone = clean(body?.phone, 40);
    const cpf = clean(body?.cpf, 40);
    const pixKey = clean(body?.pix_key, 160);
    const pixKeyType = clean(body?.pix_key_type, 20);

    if (!tag) return json({ error: "Evento inválido." }, 400);
    if (!email || !email.includes("@")) return json({ error: "Informe um e-mail válido." }, 400);
    if (!accountId) return json({ error: "Informe o seu ID." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: ev, error: evErr } = await supabase
      .from("gorjeta_events")
      .select("*")
      .ilike("tag", tag)
      .eq("is_active", true)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev) return json({ error: "Evento não encontrado." }, 404);

    const now = Date.now();
    if (ev.status === "draft") return json({ error: "Este evento ainda não foi publicado." }, 403);
    if (ev.status === "finished") return json({ error: "Este evento já foi encerrado." }, 403);
    if (ev.opens_at && now < new Date(ev.opens_at).getTime())
      return json({ error: "As inscrições ainda não abriram." }, 403);
    if (ev.closes_at && now > new Date(ev.closes_at).getTime())
      return json({ error: "As inscrições foram encerradas." }, 403);

    // Já inscrito?
    const { data: existing } = await supabase
      .from("gorjeta_event_participants")
      .select("*")
      .eq("event_id", ev.id)
      .ilike("user_email", email)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, already: true, participant: existing });
    }

    if (ev.max_participants && ev.max_participants > 0) {
      const { count } = await supabase
        .from("gorjeta_event_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id);
      if ((count ?? 0) >= ev.max_participants)
        return json({ error: "As vagas deste evento já foram preenchidas." }, 403);
    }

    // Usuário da base do operador
    const { data: wheelUser } = await supabase
      .from("wheel_users")
      .select("id, name, account_id, email, blacklisted, phone")
      .eq("owner_id", ev.owner_id)
      .ilike("email", email)
      .maybeSingle();

    if (wheelUser?.blacklisted) return json({ error: "Conta bloqueada." }, 403);

    let userId = wheelUser?.id as string | undefined;
    let finalName = wheelUser?.name || name;

    if (mode === "login") {
      if (!wheelUser) return json({ error: "Cadastro não encontrado. Inscreva-se no evento." }, 404);
      if ((wheelUser.account_id || "").trim() !== accountId)
        return json({ error: "E-mail ou ID incorretos." }, 401);
    } else {
      if (!name) return json({ error: "Informe o seu nome." }, 400);
      if (ev.require_pix && !pixKey) return json({ error: "Informe a sua chave PIX." }, 400);

      if (wheelUser) {
        const patch: Record<string, unknown> = {};
        if (phone) patch.phone = phone;
        if (cpf) patch.cpf = cpf;
        if (pixKey) { patch.pix_key = pixKey; patch.pix_key_type = pixKeyType; }
        if (Object.keys(patch).length) {
          await supabase.from("wheel_users").update(patch).eq("id", wheelUser.id);
        }
      } else {
        const { data: created, error: createErr } = await supabase
          .from("wheel_users")
          .insert({
            owner_id: ev.owner_id,
            account_id: accountId,
            email,
            name,
            phone,
            cpf,
            pix_key: pixKey || null,
            pix_key_type: pixKeyType || null,
            spins_available: 0,
          })
          .select("id, name")
          .single();
        if (createErr) throw createErr;
        userId = created.id;
        finalName = created.name;
      }
    }

    const { count: total } = await supabase
      .from("gorjeta_event_participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);

    const { data: participant, error: partErr } = await supabase
      .from("gorjeta_event_participants")
      .insert({
        event_id: ev.id,
        owner_id: ev.owner_id,
        wheel_user_id: userId ?? null,
        account_id: accountId,
        user_email: email,
        user_name: finalName,
        user_phone: phone || wheelUser?.phone || "",
        source: mode,
        entry_number: (total ?? 0) + 1,
      })
      .select("*")
      .single();
    if (partErr) throw partErr;

    return json({ ok: true, already: false, participant });
  } catch (err) {
    console.error("join-event error", err);
    return json({ error: "Não foi possível concluir a inscrição." }, 500);
  }
});
