import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    console.log("EdPay webhook received:", JSON.stringify(body));

    // Extract transaction info from webhook payload
    const edpayId = String(body.id || body.track_id || body.transaction_id || "");
    const status = body.status || "confirmed";
    const amount = body.amount || 0;
    const type = body.type || body.event || "unknown";

    if (!edpayId) {
      console.error("Webhook missing transaction ID");
      return new Response(JSON.stringify({ error: "Missing transaction ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update existing transaction by edpay_id
    const { data: existing, error: findError } = await supabase
      .from("edpay_transactions")
      .select("id")
      .eq("edpay_id", edpayId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("edpay_transactions")
        .update({
          status,
          metadata: body,
          updated_at: new Date().toISOString(),
        })
        .eq("edpay_id", edpayId);

      console.log(`Updated transaction ${edpayId} to status: ${status}`);
    } else {
      console.log(`No matching transaction found for edpay_id: ${edpayId}. Storing raw webhook.`);
    }

    // Also update prize_payments if this is a PIX transfer confirmation
    if (status === "confirmed" || status === "completed" || status === "approved") {
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
