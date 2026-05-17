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
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tag } = await req.json();
    if (!tag || typeof tag !== "string") {
      return new Response(JSON.stringify({ error: "tag required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // 1) try custom tag stored in config.updatePageConfig.tag
    let { data: wc, error } = await supabase
      .from("wheel_configs")
      .select("user_id, slug, config")
      .eq("config->updatePageConfig->>tag", tag)
      .maybeSingle();
    if (error) throw error;

    // 2) fallback: wheel slug
    if (!wc) {
      const fb = await supabase
        .from("wheel_configs")
        .select("user_id, slug, config")
        .eq("slug", tag)
        .maybeSingle();
      if (fb.error) throw fb.error;
      wc = fb.data;
    }

    if (!wc) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg: any = wc.config || {};
    return new Response(
      JSON.stringify({
        found: true,
        ownerId: wc.user_id,
        wheelSlug: wc.slug,
        updatePageConfig: cfg.updatePageConfig || {},
        gorjetaPageConfig: cfg.gorjetaPageConfig || {},
        gorjetaSeo: cfg.gorjetaSeo || {},
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("get-update-page error", err);
    return new Response(JSON.stringify({ error: "Failed to load page" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
