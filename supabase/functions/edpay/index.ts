import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  if (path !== "webhook") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log("EdPay webhook received:", JSON.stringify(body));

    const edpayId = String(body.txid || body.id || body.track_id || body.transaction_id || "");
    const rawStatus = body.status || (body.object === "in" ? "paid" : "confirmed");
    const status = rawStatus === "confirmed" || rawStatus === "completed" || rawStatus === "approved" ? "paid" : rawStatus;

    if (!edpayId) {
      console.error("Webhook missing transaction ID");
      return new Response(JSON.stringify({ error: "Missing transaction ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update existing transaction by edpay_id
    const { data: existing } = await supabase
      .from("edpay_transactions")
      .select("id, metadata")
      .eq("edpay_id", edpayId)
      .maybeSingle();

    if (existing) {
      // Merge webhook payload into existing metadata to preserve userName, userPhone, etc.
      const existingMeta = (typeof existing.metadata === "object" && existing.metadata) ? existing.metadata : {};
      const mergedMetadata = { ...existingMeta, webhook: body };

      await supabase
        .from("edpay_transactions")
        .update({
          status,
          metadata: mergedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("edpay_id", edpayId);

      console.log(`Updated transaction ${edpayId} to status: ${status}`);

      // Send deposit notification when confirmed
      if (status === "paid" && (existing as any).metadata) {
        const meta = existingMeta as Record<string, any>;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        try {
          // Fetch owner_id from the transaction
          const { data: txData } = await supabase
            .from("edpay_transactions")
            .select("owner_id, amount")
            .eq("edpay_id", edpayId)
            .maybeSingle();

          if (txData?.owner_id) {
            await fetch(`${supabaseUrl}/functions/v1/send-owner-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                ownerId: txData.owner_id,
                type: "deposit_confirmed",
                payload: {
                  userName: meta.userName || "Anônimo",
                  userPhone: meta.userPhone || "-",
                  userAccountId: meta.userAccountId || "-",
                  amount: txData.amount || 0,
                },
              }),
            });
            console.log("Deposit notification sent for", edpayId);
          }
        } catch (notifErr) {
          console.error("Failed to send deposit notification:", notifErr);
        }
      }
    } else {
      console.log(`No matching transaction found for edpay_id: ${edpayId}`);
    }

    // Update prize_payments if confirmed
    if (status === "paid") {
      const { data: payment } = await supabase
        .from("prize_payments")
        .select("id")
        .eq("edpay_transaction_id", edpayId)
        .eq("status", "processing")
        .maybeSingle();

      if (payment) {
        await supabase
          .from("prize_payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        console.log(`Prize payment ${payment.id} marked as paid via webhook`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
