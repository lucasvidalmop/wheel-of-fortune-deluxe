import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tag } = await req.json();
    if (!tag || typeof tag !== "string") {
      return new Response(JSON.stringify({ error: "tag required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: cfg, error: cfgErr } = await supabase
      .from("lobby_configs")
      .select("owner_id, tag, is_active, page_config")
      .eq("tag", tag)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Discover tags of operator's other products to suggest defaults for hrefs.
    const [{ data: bets }, { data: lucky }, { data: wheel }] = await Promise.all([
      supabase.from("bets_configs").select("tag").eq("owner_id", cfg.owner_id).eq("is_active", true).maybeSingle(),
      supabase.from("luckybox_configs").select("tag").eq("owner_id", cfg.owner_id).eq("is_active", true).maybeSingle(),
      supabase.from("wheel_configs").select("slug").eq("user_id", cfg.owner_id).maybeSingle().then((r) => r as any),
    ]);

    return new Response(JSON.stringify({
      found: true,
      ownerId: cfg.owner_id,
      tag: cfg.tag,
      isActive: cfg.is_active,
      pageConfig: cfg.page_config || {},
      productTags: {
        bets: bets?.tag || "",
        luckybox: lucky?.tag || "",
        roleta: wheel?.slug || "",
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("get-lobby-page error", err);
    return new Response(JSON.stringify({ error: "Failed to load page" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
