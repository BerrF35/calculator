// =============================================================================
// Supabase Edge Function: verify-razorpay-payment
// Cryptographic HMAC-SHA256 Signature Verification & Entitlement Unlock
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Compute HMAC-SHA256 in Web Crypto
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: "RAZORPAY_KEY_SECRET is not configured in Edge Function environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan = "yearly" } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing payment verification parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Official Razorpay formula: HMAC-SHA256 of `order_id + "|" + payment_id`
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = await computeHmacSha256(razorpayKeySecret, payload);

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Razorpay signature mismatch!");
      return new Response(
        JSON.stringify({ error: "Cryptographic signature verification failed", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Payment verified successfully for user: ${user.id}`);

    // Authoritative Database Update: Unlock Premium Entitlement
    const { error: dbError } = await supabaseAdmin
      .from("entitlements")
      .upsert({
        user_id: user.id,
        stripe_customer_id: razorpay_payment_id, // Store payment ID
        stripe_subscription_id: razorpay_order_id, // Store order ID
        plan: "premium",
        status: "active",
        billing_cycle: plan,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Database update error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to persist premium entitlement" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        verified: true,
        entitled: true,
        plan: "premium",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
