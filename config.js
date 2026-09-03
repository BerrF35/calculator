/* ==========================================================================
   ApexCalc - Client Configuration
   
   Configured with:
   - Supabase Project Reference: fwacrzumdhcyeyiwnnhy
   - Supabase Publishable Key: sb_publishable__EYaJZtA9sfsXuBA_cIlEw_DAPWrlmC
   - Razorpay Key ID: Used by client to open payment modal
   
   SECURITY NOTE:
   - Only public keys (Supabase anon/publishable key and Razorpay Key ID `rzp_test_...`)
     belong here.
   - Private secrets (Razorpay Key Secret, Webhook Secret, Supabase Service Role Key)
     belong exclusively in your serverless Edge Functions environment variables.
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'https://fwacrzumdhcyeyiwnnhy.supabase.co',
  anonKey: 'sb_publishable__EYaJZtA9sfsXuBA_cIlEw_DAPWrlmC'
};

const RAZORPAY_CONFIG = {
  keyId: 'YOUR_RAZORPAY_KEY_ID_HERE' // e.g. 'rzp_test_...'
};
