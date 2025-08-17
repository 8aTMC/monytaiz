-- Fix the security definer view issue by making it a regular view
-- The view doesn't need to be security definer since it only shows public data

DROP VIEW IF EXISTS public.content_discovery;

-- Recreate as a regular view (not security definer)
CREATE VIEW public.content_discovery AS
SELECT 
  id,
  title,
  content_type,
  base_price,
  is_pack,
  thumbnail_url,
  created_at
  -- Deliberately exclude: creator_id, description, file_path, file_size
FROM public.content_files 
WHERE is_active = true;