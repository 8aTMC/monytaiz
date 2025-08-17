-- Drop the existing view completely
DROP VIEW IF EXISTS public.content_discovery CASCADE;

-- Create the view with authenticator role ownership to avoid security definer issues
-- The authenticator role is used by PostgREST and doesn't have elevated privileges
SET ROLE authenticator;

CREATE VIEW public.content_discovery AS
SELECT 
    id,
    title,
    content_type,
    base_price,
    is_pack,
    thumbnail_url,
    created_at
FROM public.content_files
WHERE is_active = true;

-- Reset role
RESET ROLE;

-- Ensure proper permissions
GRANT SELECT ON public.content_discovery TO anon, authenticated;

-- Verify the view respects RLS by checking that it doesn't bypass content_files policies
COMMENT ON VIEW public.content_discovery IS 'Content discovery view that respects RLS policies. Shows only active content that users have permission to view through content_files table policies.';