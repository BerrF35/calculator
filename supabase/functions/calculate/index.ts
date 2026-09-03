// =============================================================================
// Supabase Edge Function: calculate
// Secure Server-Side Scientific Expression Evaluator
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as math from "npm:mathjs@11.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: snap values very close to zero to eliminate floating-point roundoff
function snapZero(val: unknown): unknown {
  if (typeof val === "number" && Math.abs(val) < 1e-12) {
    return 0;
  }
  return val;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization Header
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Authenticate User via JWT
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check Server-Side Entitlement
    const { data: entitlement, error: entError } = await supabaseAdmin
      .from("entitlements")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPremium = !entError && entitlement?.plan === "premium" && entitlement?.status === "active";

    if (!isPremium) {
      return new Response(
        JSON.stringify({
          error: "Active premium subscription required to evaluate scientific expressions.",
          entitled: false,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse Calculation Request
    const { expression, angleMode = "DEG" } = await req.json();
    if (!expression || typeof expression !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid expression" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Evaluate Expression with Scope
    const degToRad = (x: number) => (x * Math.PI) / 180;
    const radToDeg = (x: number) => (x * 180) / Math.PI;

    const scope: Record<string, unknown> = {
      pi: Math.PI,
      e: Math.E,
    };

    if (angleMode === "DEG") {
      scope.sin = (x: number) => snapZero(math.sin(degToRad(x)));
      scope.cos = (x: number) => snapZero(math.cos(degToRad(x)));
      scope.tan = (x: number) => {
        const normalized = ((x % 180) + 180) % 180;
        if (Math.abs(normalized - 90) < 1e-10) throw new Error("Undefined (tan 90°)");
        return snapZero(math.tan(degToRad(x)));
      };
      scope.asin = (x: number) => {
        if (x < -1 || x > 1) throw new Error("Domain error");
        return snapZero(radToDeg(math.asin(x)));
      };
      scope.acos = (x: number) => {
        if (x < -1 || x > 1) throw new Error("Domain error");
        return snapZero(radToDeg(math.acos(x)));
      };
      scope.atan = (x: number) => snapZero(radToDeg(math.atan(x)));
    } else {
      scope.sin = (x: number) => snapZero(math.sin(x));
      scope.cos = (x: number) => snapZero(math.cos(x));
      scope.tan = (x: number) => snapZero(math.tan(x));
      scope.asin = (x: number) => {
        if (x < -1 || x > 1) throw new Error("Domain error");
        return snapZero(math.asin(x));
      };
      scope.acos = (x: number) => {
        if (x < -1 || x > 1) throw new Error("Domain error");
        return snapZero(math.acos(x));
      };
      scope.atan = (x: number) => snapZero(math.atan(x));
    }

    let rawResult = math.evaluate(expression, scope);
    if (typeof rawResult === "number") {
      rawResult = snapZero(rawResult);
      rawResult = math.format(rawResult, { precision: 12 });
    }

    return new Response(
      JSON.stringify({
        result: String(rawResult),
        entitled: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Calculation failed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
