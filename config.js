/* ==========================================================================
   ApexCalc - Client Configuration
   
   INSTRUCTIONS FOR YOU:
   1. Open your Supabase Dashboard: https://supabase.com/dashboard
   2. Go to your Project -> Project Settings -> API
   3. Copy "Project URL" and paste below in `url`.
   4. Copy the "anon" / "public" key and paste below in `anonKey`.
   
   SECURITY NOTE:
   - The "anon" key is SAFE to expose in public frontend code. It only has
     access to data permitted by Row Level Security (RLS) policies.
   - NEVER paste your "service_role" secret key here.
   ========================================================================== */

const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL_HERE',
  anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE'
};
