// =============================================================================
// Supabase Edge Function: create-razorpay-order
// Creates a Razorpay Order in Indian Rupees (₹)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: "Razorpay credentials not configured in Edge Function environment variables" }),
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

    const { plan = "yearly" } = await req.json();
    const isYearly = plan === "yearly";
    // 1 INR = 100 paise
    const amountInPaise = isYearly ? 100000 : 10000; // ₹1,000 or ₹100

    // Basic Auth credentials for Razorpay API
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          userId: user.id,
          userEmail: user.email,
          plan: plan,
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      return new Response(
        JSON.stringify({ error: `Razorpay API error: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderData = await rzpResponse.json();

    return new Response(
      JSON.stringify({
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        keyId: razorpayKeyId,
        plan: plan,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Order creation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
