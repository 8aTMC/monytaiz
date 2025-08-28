-- Fix Security Definer View issue by removing SECURITY DEFINER and relying on RLS policies

-- First, drop the existing view
DROP VIEW IF EXISTS public.fan_my_media;

-- Recreate the get_fan_my_media function WITHOUT SECURITY DEFINER
-- This will rely on proper RLS policies instead of bypassing them
CREATE OR REPLACE FUNCTION public.get_fan_my_media()
 RETURNS TABLE(id uuid, creator_id uuid, origin text, storage_path text, mime text, type text, size_bytes bigint, title text, tags text[], suggested_price_cents integer, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, granted_at timestamp with time zone, grant_type text, price_cents integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- Now relies on RLS policies of fan_media_grants and media tables
  -- Users can only see data they have proper access to via RLS
  SELECT 
    m.id,
    m.creator_id,
    m.origin,
    m.storage_path,
    m.mime,
    m.type,
    m.size_bytes,
    m.title,
    m.tags,
    m.suggested_price_cents,
    m.notes,
    m.created_at,
    m.updated_at,
    g.granted_at,
    g.grant_type,
    g.price_cents
  FROM fan_media_grants g
  JOIN media m ON m.id = g.media_id
  -- RLS policies on both tables will automatically filter results
  -- based on the current user's permissions
$function$;

-- Recreate the view
CREATE VIEW public.fan_my_media AS
 SELECT id,
    creator_id,
    origin,
    storage_path,
    mime,
    type,
    size_bytes,
    title,
    tags,
    suggested_price_cents,
    notes,
    created_at,
    updated_at,
    granted_at,
    grant_type,
    price_cents
   FROM get_fan_my_media();

-- Grant proper permissions
GRANT SELECT ON public.fan_my_media TO authenticated;

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_definer_view_fixed',
  'view',
  NULL,
  jsonb_build_object(
    'view_name', 'fan_my_media',
    'function_name', 'get_fan_my_media',
    'security_fix', 'removed SECURITY DEFINER, now relies on RLS policies',
    'impact', 'improved security by enforcing proper access control'
  )
);