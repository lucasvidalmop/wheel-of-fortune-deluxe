import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL_KEYS = [
  "roleta", "sms", "email", "email_brevo", "whatsapp", "financeiro", "gorjeta", "referral",
  "inscritos", "auth", "history", "analytics", "msg_analytics", "notificacoes", "configuracoes", "painel_casa"
] as const;
type ToolKey = typeof TOOL_KEYS[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Não autenticado" }, 401);
    const callerId = claims.claims.sub as string;

    const { data: roleData } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Acesso negado" }, 403);

    const { action, user_id, permissions } = await req.json();

    const sanitize = (input: any): Partial<Record<ToolKey, boolean>> => {
      const out: Partial<Record<ToolKey, boolean>> = {};
      if (input && typeof input === "object") {
        for (const key of TOOL_KEYS) {
          if (typeof input[key] === "boolean") out[key] = input[key];
        }
      }
      return out;
    };

    if (action === "list") {
      const [{ data: defaults }, { data: rows }] = await Promise.all([
        admin.from("operator_permissions_defaults").select("*").eq("id", 1).maybeSingle(),
        admin.from("operator_permissions").select("*"),
      ]);
      return json({ defaults: defaults || null, permissions: rows || [] });
    }

    if (action === "update_defaults") {
      const patch = sanitize(permissions);
      const { error } = await admin
        .from("operator_permissions_defaults")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "update_user") {
      if (!user_id) return json({ error: "user_id é obrigatório" }, 400);
      const patch = sanitize(permissions);
      // Upsert
      const { data: existing } = await admin
        .from("operator_permissions").select("user_id").eq("user_id", user_id).maybeSingle();
      if (existing) {
        const { error } = await admin
          .from("operator_permissions")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("user_id", user_id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("operator_permissions")
          .insert({ user_id, ...patch });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ success: true });
    }

    if (action === "reset_user") {
      if (!user_id) return json({ error: "user_id é obrigatório" }, 400);
      await admin.from("operator_permissions").delete().eq("user_id", user_id);
      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    return json({ error: err?.message || "erro" }, 500);
  }
});
