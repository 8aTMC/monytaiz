-- Fix the function to have proper security settings
CREATE OR REPLACE FUNCTION generate_temp_username()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'User' || EXTRACT(EPOCH FROM NOW())::bigint || FLOOR(RANDOM() * 1000)::text;
$$;