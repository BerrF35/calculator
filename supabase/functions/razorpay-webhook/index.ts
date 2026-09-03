// =============================================================================
// Supabase Edge Function: razorpay-webhook
// Authoritative Asynchronous Webhook Receiver
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function computeHmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const signature = req.headers.get("x-razorpay-signature");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret configuration", { status: 400 });
  }

  const rawBody = await req.text();

  // Cryptographically verify the webhook signature
  const expectedSignature = await computeHmacSha256(webhookSecret, rawBody);
  if (expectedSignature !== signature) {
    console.error("⚠️ Razorpay webhook signature verification failed!");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  console.log(`🔔 Received authoritative Razorpay webhook: ${event.event}`);

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity || event.payload?.order?.entity;
      const userId = paymentEntity?.notes?.userId;
      const plan = paymentEntity?.notes?.plan || "yearly";

      if (userId) {
        console.log(`✅ Webhook unlocking premium entitlement for user: ${userId}`);
        await supabaseAdmin
          .from("entitlements")
          .upsert({
            user_id: userId,
            stripe_customer_id: paymentEntity.id,
            stripe_subscription_id: paymentEntity.order_id,
            plan: "premium",
            status: "active",
            billing_cycle: plan,
            updated_at: new Date().toISOString(),
          });
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Database update error during webhook:", err);
    return new Response("Internal server error", { status: 500 });
  }
});
