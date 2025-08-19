-- Add fields to track signup completion status and provider verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signup_completed boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS google_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS temp_username boolean DEFAULT false;

-- Update existing profiles to have signup_completed = true by default
UPDATE public.profiles 
SET signup_completed = true 
WHERE signup_completed IS NULL;

-- Create function to generate temporary username
CREATE OR REPLACE FUNCTION generate_temp_username()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'User' || EXTRACT(EPOCH FROM NOW())::bigint || FLOOR(RANDOM() * 1000)::text;
$$;