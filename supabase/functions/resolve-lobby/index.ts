import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Resolve the operator's active lobby tag from a public path.
// Supported paths:
//   /odds=<tag>           -> bets_configs.tag
//   /luckybox=<tag>       -> luckybox_configs.tag
//   /dep=<tag>            -> bets_configs.tag (fallback luckybox/wheel)
//   /depbs=<tag>          -> bets_configs.tag
//   /resgate=<tag>        -> wheel_configs.slug (fallback others)
//   /atualizar=<tag>      -> wheel_configs.slug (fallback others)
//   /lobby=<tag>          -> lobby_configs.tag (just returns itself if active)
//   /ref/<code>           -> referral_links.code
//   /<slug>               -> wheel_configs.slug

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { path } = await req.json();
    if (!path || typeof path !== "string") {
      return new Response(JSON.stringify({ lobbyTag: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const segments = path.split("/").filter(Boolean);
    const first = segments[0] || "";

    const tryBets = async (tag: string) => {
      const { data } = await supabase.from("bets_configs").select("owner_id").eq("tag", tag).maybeSingle();
      return data?.owner_id || null;
    };
    const tryLucky = async (tag: string) => {
      const { data } = await supabase.from("luckybox_configs").select("owner_id").eq("tag", tag).maybeSingle();
      return data?.owner_id || null;
    };
    const tryWheel = async (slug: string) => {
      const { data } = await supabase.from("wheel_configs").select("user_id").eq("slug", slug).maybeSingle();
      return (data as any)?.user_id || null;
    };
    const tryLobby = async (tag: string) => {
      const { data } = await supabase.from("lobby_configs").select("owner_id").eq("tag", tag).maybeSingle();
      return data?.owner_id || null;
    };
    const tryReferral = async (code: string) => {
      const { data } = await supabase.from("referral_links").select("owner_id").eq("code", code).maybeSingle();
      return data?.owner_id || null;
    };

    let ownerId: string | null = null;

    if (first.startsWith("odds=")) ownerId = await tryBets(first.substring(5));
    else if (first.startsWith("luckybox=")) ownerId = await tryLucky(first.substring(9));
    else if (first.startsWith("lobby=")) ownerId = await tryLobby(first.substring(6));
    else if (first.startsWith("dep=") || first.startsWith("depbs=")) {
      const tag = first.split("=")[1] || "";
      const [b, l, w] = await Promise.all([tryBets(tag), tryLucky(tag), tryWheel(tag)]);
      ownerId = b || l || w;
    } else if (first.startsWith("resgate=") || first.startsWith("atualizar=")) {
      const tag = first.split("=")[1] || "";
      const [w, b, l] = await Promise.all([tryWheel(tag), tryBets(tag), tryLucky(tag)]);
      ownerId = w || b || l;
    } else if (first === "ref" && segments[1]) {
      ownerId = await tryReferral(segments[1]);
    } else if (first && !["admin", "dashboard", "unsubscribe", "gorjeta", "influencer", "batalha"].includes(first)) {
      ownerId = await tryWheel(first);
    }

    if (!ownerId) {
      return new Response(JSON.stringify({ lobbyTag: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lobby } = await supabase
      .from("lobby_configs")
      .select("tag, is_active")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const lobbyTag = lobby?.is_active ? (lobby.tag || "") : "";
    return new Response(JSON.stringify({ lobbyTag }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resolve-lobby error", err);
    return new Response(JSON.stringify({ lobbyTag: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
