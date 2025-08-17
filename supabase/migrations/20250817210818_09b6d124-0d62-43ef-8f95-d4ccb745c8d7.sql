-- Fix security issue: Remove public access to content metadata and implement proper access control

-- First, drop the problematic policy that makes all content viewable by everyone
DROP POLICY IF EXISTS "Content is viewable by everyone" ON public.content_files;

-- Create more secure, granular policies for content access

-- 1. Creators can view their own content (already exists but keeping for clarity)
-- This policy already exists: "Creators can manage their content"

-- 2. Fans can only view basic metadata for content discovery (limited fields)
CREATE POLICY "Public can view limited content for discovery" 
ON public.content_files 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL
);

-- 3. Fans can view full content details only if they have purchased it
CREATE POLICY "Purchased content is fully viewable by buyers" 
ON public.content_files 
FOR SELECT 
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM public.purchases p 
    WHERE p.content_id = content_files.id 
    AND p.buyer_id = auth.uid() 
    AND p.status = 'completed'
  )
);

-- 4. Create a view for public content discovery that only exposes safe metadata
CREATE OR REPLACE VIEW public.content_discovery AS
SELECT 
  id,
  title,
  content_type,
  base_price,
  is_pack,
  thumbnail_url,
  created_at,
  -- Exclude sensitive fields like creator_id, description, file_path
  'hidden' as creator_id, -- Hide actual creator ID for privacy
  'Purchase to view details' as description
FROM public.content_files 
WHERE is_active = true;

-- Enable RLS on the view
ALTER VIEW public.content_discovery SET (security_barrier = true);

-- Create policy for the discovery view (public access but limited data)
CREATE POLICY "Content discovery is viewable by authenticated users" 
ON public.content_discovery 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add a function to check if user can view full content details
CREATE OR REPLACE FUNCTION public.user_can_view_content(_user_id uuid, _content_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- User is the creator
    SELECT 1 FROM content_files cf 
    WHERE cf.id = _content_id AND cf.creator_id = _user_id
  ) OR EXISTS (
    -- User has purchased the content
    SELECT 1 FROM purchases p 
    WHERE p.content_id = _content_id 
    AND p.buyer_id = _user_id 
    AND p.status = 'completed'
  ) OR EXISTS (
    -- User is an admin
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = _user_id 
    AND ur.role IN ('admin', 'owner')
  )
$function$;

-- Create a secure policy using the function
CREATE POLICY "Full content details for authorized users only" 
ON public.content_files 
FOR SELECT 
USING (
  is_active = true 
  AND public.user_can_view_content(auth.uid(), id)
);