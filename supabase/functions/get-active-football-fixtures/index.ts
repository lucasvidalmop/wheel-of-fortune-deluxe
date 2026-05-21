// Returns active football fixtures imported in bet_events.
// VPS uses this to know which external_fixture_id to resolve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Shared-secret auth (same secret as resolve-football-event)
  const expected = Deno.env.get("RESOLVE_FOOTBALL_SECRET");
  const got = req.headers.get("x-webhook-secret") || "";
  if (!expected || got !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
    : ["open", "live"];

  const { data, error } = await supabase
    .from("bet_events")
    .select("external_fixture_id, status, starts_at")
    .not("external_fixture_id", "is", null)
    .in("status", statuses)
    .order("starts_at", { ascending: true });

  if (error) return json({ error: "db_error", detail: error.message }, 500);

  // Deduplicate by external_fixture_id (multi-tenant: same fixture may exist for multiple owners)
  const seen = new Map<string, { external_fixture_id: string; status: string; starts_at: string }>();
  for (const row of data || []) {
    const id = String(row.external_fixture_id);
    if (!seen.has(id)) {
      seen.set(id, {
        external_fixture_id: id,
        status: row.status,
        starts_at: row.starts_at,
      });
    }
  }

  const fixtures = Array.from(seen.values());
  return json({ ok: true, count: fixtures.length, fixtures });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
