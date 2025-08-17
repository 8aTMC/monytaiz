-- Drop the existing content_discovery view that has security definer issues
DROP VIEW IF EXISTS public.content_discovery;

-- Recreate the view with proper RLS enforcement
-- This view will now respect the RLS policies on content_files table
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

-- Grant appropriate permissions to roles
GRANT SELECT ON public.content_discovery TO anon, authenticated;

-- Add a comment explaining the purpose and security considerations
COMMENT ON VIEW public.content_discovery IS 'Safe content discovery view that respects RLS policies on content_files table. Users can only see content they have permission to view based on the underlying table policies.';