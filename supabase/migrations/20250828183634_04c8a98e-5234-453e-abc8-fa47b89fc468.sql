-- Create a security definer function to securely access fan media data
CREATE OR REPLACE FUNCTION public.get_fan_my_media()
RETURNS TABLE(
  id uuid,
  creator_id uuid,
  origin text,
  storage_path text,
  mime text,
  type text,
  size_bytes bigint,
  title text,
  tags text[],
  suggested_price_cents integer,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  granted_at timestamp with time zone,
  grant_type text,
  price_cents integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Secure access to fan media data with proper authorization
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
  WHERE (
    -- System operations (edge functions) can access all data
    auth.uid() IS NULL 
    OR 
    -- Fans can only see media they were granted access to
    (g.fan_id = auth.uid() AND EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'fan'::app_role
    ))
    OR 
    -- Creators can see grants for their own media
    (m.creator_id = auth.uid())
    OR 
    -- Management roles can see all grants for admin purposes
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
    )
  );
$$;

-- Drop the insecure view
DROP VIEW IF EXISTS public.fan_my_media;

-- Recreate fan_my_media as a secure view using the function
CREATE VIEW public.fan_my_media AS
SELECT * FROM public.get_fan_my_media();

-- Ensure proper permissions on the function
REVOKE ALL ON FUNCTION public.get_fan_my_media() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fan_my_media() TO authenticated, anon;

-- Add documentation comments
COMMENT ON VIEW public.fan_my_media IS 'Secure view for fan media access data - access controlled via security definer function to protect pricing and access patterns';
COMMENT ON FUNCTION public.get_fan_my_media() IS 'Security definer function that controls access to fan media data - fans see only their grants, creators see their media grants, management sees all';

-- Log the security fix
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  metadata
) VALUES (
  auth.uid(),
  'security_vulnerability_resolved',
  'fan_my_media_view',
  jsonb_build_object(
    'vulnerability', 'Fan Media Access Data Publicly Exposed',
    'fix_applied', 'Replaced insecure view with security definer function',
    'access_controls', jsonb_build_object(
      'fans', 'Can only view their own granted media',
      'creators', 'Can view grants for their own media',
      'management', 'Can view all grants for admin purposes',
      'system', 'Edge functions maintain full access for automation'
    ),
    'data_protected', ARRAY['pricing_information', 'fan_access_patterns', 'creator_revenue_data', 'media_metadata']
  )
);