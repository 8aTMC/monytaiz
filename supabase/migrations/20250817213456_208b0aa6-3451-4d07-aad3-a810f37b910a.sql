-- Drop the existing view
DROP VIEW IF EXISTS public.content_discovery CASCADE;

-- Instead of a view, let's create a security definer function that returns a table
-- This approach gives us better control over security and avoids the security definer view issue
CREATE OR REPLACE FUNCTION public.get_content_discovery()
RETURNS TABLE (
    id uuid,
    title text,
    content_type content_type,
    base_price numeric,
    is_pack boolean,
    thumbnail_url text,
    created_at timestamp with time zone
)
LANGUAGE sql
SECURITY INVOKER  -- This ensures it runs with the permissions of the calling user
STABLE
AS $$
    SELECT 
        cf.id,
        cf.title,
        cf.content_type,
        cf.base_price,
        cf.is_pack,
        cf.thumbnail_url,
        cf.created_at
    FROM public.content_files cf
    WHERE cf.is_active = true;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_content_discovery() TO anon, authenticated;

-- Add comment explaining the security approach
COMMENT ON FUNCTION public.get_content_discovery() IS 'Returns discoverable content respecting RLS policies. Uses SECURITY INVOKER to run with calling user permissions.';