import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: linkData, error: linkError } = await supabase
      .from("referral_links")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (linkError) throw linkError;

    if (!linkData) {
      return new Response(JSON.stringify({ linkData: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wheelConfig, error: configError } = await supabase
      .from("wheel_configs")
      .select("slug, config")
      .eq("user_id", linkData.owner_id)
      .maybeSingle();

    if (configError) throw configError;

    return new Response(
      JSON.stringify({
        linkData,
        wheelSlug: wheelConfig?.slug || "",
        gorjetaPageConfig: wheelConfig?.config?.gorjetaPageConfig || {},
        gorjetaSeo: wheelConfig?.config?.gorjetaSeo || {},
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("get-gorjeta-page error", error);
    return new Response(JSON.stringify({ error: "Failed to load page" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
