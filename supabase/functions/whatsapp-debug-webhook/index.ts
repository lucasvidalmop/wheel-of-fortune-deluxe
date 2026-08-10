import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { instanceLabel, ownerId } = await req.json();
    const { data: configRow } = await admin.from("wheel_configs").select("config").eq("user_id", ownerId).maybeSingle();
    const ds = (configRow?.config as any)?.dashboardSettings || {};
    const map: Record<string, { url?: string; key?: string; instance?: string }> = {
      whatsapp: { url: ds.evolutionApiUrl, key: ds.evolutionApiKey, instance: ds.evolutionInstance },
      whatsapp2: { url: ds.evolutionApiUrl2, key: ds.evolutionApiKey2, instance: ds.evolutionInstance2 },
      whatsapp3: { url: ds.evolutionApiUrl3, key: ds.evolutionApiKey3, instance: ds.evolutionInstance3 },
      notify: { url: ds.notifyEvolutionApiUrl, key: ds.notifyEvolutionApiKey, instance: ds.notifyEvolutionInstance },
    };
    const cfg = map[String(instanceLabel)];
    if (!cfg?.url || !cfg?.key || !cfg?.instance) return json({ error: "Instância não configurada" }, 400);

    const baseUrl = String(cfg.url).replace(/\/+$/, "").replace(/\/manager$/i, "");
    const resp = await fetch(`${baseUrl}/webhook/find/${cfg.instance}`, { headers: { apikey: cfg.key } });
    const text = await resp.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }

    const settingsResp = await fetch(`${baseUrl}/settings/find/${cfg.instance}`, { headers: { apikey: cfg.key } });
    const settingsText = await settingsResp.text();
    let settingsBody: unknown;
    try { settingsBody = JSON.parse(settingsText); } catch { settingsBody = settingsText; }

    const stateResp = await fetch(`${baseUrl}/instance/connectionState/${cfg.instance}`, { headers: { apikey: cfg.key } });
    const stateText = await stateResp.text();
    let stateBody: unknown;
    try { stateBody = JSON.parse(stateText); } catch { stateBody = stateText; }

    return json({ ok: true, status: resp.status, webhookConfig: body, settings: settingsBody, connectionState: stateBody });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "erro desconhecido" }, 500);
  }
});
