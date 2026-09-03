// =============================================================================
// Supabase Edge Function: stripe-webhook
// Authoritative Payment Fulfillment & Entitlement Sync
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.25.0";

Deno.serve(async (req) => {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const signature = req.headers.get("stripe-signature");

  if (!signature || !endpointSecret) {
    return new Response("Missing signature or webhook secret configuration", { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    // Cryptographically verify the webhook signature
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`🔔 Received authoritative Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const plan = session.metadata?.plan || "yearly";

        if (userId) {
          console.log(`✅ Unlocking premium entitlement for user: ${userId}`);
          await supabaseAdmin
            .from("entitlements")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: "premium",
              status: "active",
              billing_cycle: plan,
              updated_at: new Date().toISOString(),
            });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status; // 'active', 'past_due', 'unpaid', etc.

        console.log(`🔄 Updating subscription status to ${status} for customer ${customerId}`);
        await supabaseAdmin
          .from("entitlements")
          .update({
            status: status === "active" ? "active" : "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`❌ Subscription canceled for customer ${customerId}, reverting to free tier.`);
        await supabaseAdmin
          .from("entitlements")
          .update({
            plan: "free",
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (dbErr) {
    console.error("Database update error during webhook handling:", dbErr);
    return new Response("Internal error updating entitlement", { status: 500 });
  }
});
