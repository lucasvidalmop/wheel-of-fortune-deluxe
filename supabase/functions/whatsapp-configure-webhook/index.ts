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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: userData } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = userData.user?.id;
  if (!userId) return json({ error: "Sessão inválida" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { instanceLabel } = await req.json();
    const { data: configRow } = await admin.from("wheel_configs").select("config").eq("user_id", userId).maybeSingle();
    const ds = (configRow?.config as any)?.dashboardSettings || {};

    const map: Record<string, { url?: string; key?: string; instance?: string }> = {
      whatsapp: { url: ds.evolutionApiUrl, key: ds.evolutionApiKey, instance: ds.evolutionInstance },
      whatsapp2: { url: ds.evolutionApiUrl2, key: ds.evolutionApiKey2, instance: ds.evolutionInstance2 },
      whatsapp3: { url: ds.evolutionApiUrl3, key: ds.evolutionApiKey3, instance: ds.evolutionInstance3 },
      notify: { url: ds.notifyEvolutionApiUrl, key: ds.notifyEvolutionApiKey, instance: ds.notifyEvolutionInstance },
    };
    const cfg = map[String(instanceLabel)];
    if (!cfg?.url || !cfg?.key || !cfg?.instance) {
      return json({ error: "Instância não configurada" }, 400);
    }

    const baseUrl = String(cfg.url).replace(/\/+$/, "").replace(/\/manager$/i, "");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-activity-webhook`;

    const resp = await fetch(`${baseUrl}/webhook/set/${cfg.instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.key },
      body: JSON.stringify({
        webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, events: ["MESSAGES_UPSERT"] },
      }),
    });
    const respBody = await resp.text();
    if (!resp.ok) {
      console.error("whatsapp-configure-webhook: falha na Evolution API", respBody);
      return json({ error: "Falha ao configurar webhook na Evolution API", details: respBody }, 502);
    }

    return json({ ok: true, webhookUrl });
  } catch (err) {
    console.error("whatsapp-configure-webhook error", err);
    return json({ error: err instanceof Error ? err.message : "erro desconhecido" }, 500);
  }
});
