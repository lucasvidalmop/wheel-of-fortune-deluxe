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
    const { instanceLabel } = await req.json(); // "whatsapp" | "whatsapp2" | "notify"
    const { data: configRow } = await admin.from("wheel_configs").select("config").eq("user_id", userId).maybeSingle();
    const ds = (configRow?.config as any)?.dashboardSettings || {};

    const map: Record<string, { url?: string; key?: string; instance?: string }> = {
      whatsapp: { url: ds.evolutionApiUrl, key: ds.evolutionApiKey, instance: ds.evolutionInstance },
      whatsapp2: { url: ds.evolutionApiUrl2, key: ds.evolutionApiKey2, instance: ds.evolutionInstance2 },
      notify: { url: ds.notifyEvolutionApiUrl, key: ds.notifyEvolutionApiKey, instance: ds.notifyEvolutionInstance },
    };
    const cfg = map[String(instanceLabel)];
    if (!cfg?.url || !cfg?.key || !cfg?.instance) {
      return json({ error: "Instância não configurada" }, 400);
    }

    const baseUrl = String(cfg.url).replace(/\/+$/, "").replace(/\/manager$/i, "");
    const resp = await fetch(`${baseUrl}/group/fetchAllGroups/${cfg.instance}?getParticipants=false`, {
      headers: { apikey: cfg.key },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("whatsapp-list-groups: falha na Evolution API", errText);
      return json({ error: "Falha ao buscar grupos na Evolution API" }, 502);
    }
    const groups = await resp.json();
    const list = (Array.isArray(groups) ? groups : []).map((g: any) => ({
      id: g.id || g.jid, name: g.subject || g.name || g.id,
    })).filter((g: any) => g.id);

    return json({ ok: true, instance: cfg.instance, groups: list });
  } catch (err) {
    console.error("whatsapp-list-groups error", err);
    return json({ error: err instanceof Error ? err.message : "erro desconhecido" }, 500);
  }
});
