-- Fix the search path issue for the content discovery function
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
SET search_path TO 'public'  -- Fix: Set explicit search path for security
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