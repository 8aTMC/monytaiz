-- Fix security issue: Remove public access to content metadata and implement proper access control

-- First, drop the problematic policy that makes all content viewable by everyone
DROP POLICY IF EXISTS "Content is viewable by everyone" ON public.content_files;

-- Drop any failed policies from previous attempt
DROP POLICY IF EXISTS "Public can view limited content for discovery" ON public.content_files;
DROP POLICY IF EXISTS "Purchased content is fully viewable by buyers" ON public.content_files;
DROP POLICY IF EXISTS "Full content details for authorized users only" ON public.content_files;

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

-- Create secure policy that only allows access to authorized users
CREATE POLICY "Content viewable by authorized users only" 
ON public.content_files 
FOR SELECT 
USING (
  is_active = true 
  AND public.user_can_view_content(auth.uid(), id)
);

-- Create a separate view for content discovery with limited metadata
CREATE OR REPLACE VIEW public.content_discovery AS
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