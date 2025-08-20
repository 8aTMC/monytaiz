-- Fix security issues by updating function search paths

-- Update the existing function to have proper search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update the generate temp username function
CREATE OR REPLACE FUNCTION public.generate_temp_username()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'User' || EXTRACT(EPOCH FROM NOW())::bigint || FLOOR(RANDOM() * 1000)::text;
$$;