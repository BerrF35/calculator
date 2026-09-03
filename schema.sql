-- =============================================================================
-- ApexCalc Database Schema & Row Level Security (RLS)
-- Paste this script into your Supabase SQL Editor and click "Run".
-- =============================================================================

-- 1. Create Profiles Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Entitlements Table (Authoritative source of premium access)
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',          -- 'free' or 'premium'
  status TEXT NOT NULL DEFAULT 'inactive',     -- 'active', 'canceled', 'past_due'
  billing_cycle TEXT DEFAULT 'monthly',       -- 'monthly' (₹100) or 'yearly' (₹1,000)
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Users can ONLY read their own records
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can read own entitlement"
  ON public.entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: No INSERT or UPDATE policies are granted to authenticated users for entitlements.
-- Only the backend (service_role via Stripe webhooks) can modify entitlements!

-- 5. Automatic Profile & Free Entitlement Trigger on User Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;

  -- Insert default free entitlement
  INSERT INTO public.entitlements (user_id, plan, status)
  VALUES (new.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
