import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Expire all spins where spins_expire_at has passed
    const { data, error } = await supabase
      .from("wheel_users")
      .update({
        spins_available: 0,
        fixed_prize_enabled: false,
        fixed_prize_segment: null,
        spins_expire_at: null,
        updated_at: new Date().toISOString(),
      })
      .not("spins_expire_at", "is", null)
      .lte("spins_expire_at", new Date().toISOString())
      .gt("spins_available", 0)
      .select("id, name, email, owner_id");

    const expired = data?.length ?? 0;
    console.log(`Expired spins for ${expired} user(s)`);

    return new Response(
      JSON.stringify({ success: true, expired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("expire-spins error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
