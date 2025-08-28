-- Fix critical security vulnerability: Remove overly permissive profile access policy
-- This prevents unauthorized access to user personal information

-- First, let's remove the dangerous policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON public.profiles;

-- Create a more restrictive policy that only allows users to view limited public profile info
-- when explicitly needed (e.g., for conversation participants)
CREATE POLICY "Users can view limited profile info for conversations" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can only see profiles of people they have conversations with
  (deletion_status = 'active'::text) AND (
    -- User can see their own profile (already covered by another policy, but being explicit)
    (auth.uid() = id) OR
    -- User can see profiles of people they have active conversations with (as fan or creator)
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.status = 'active' 
      AND (
        (c.fan_id = auth.uid() AND c.creator_id = profiles.id) OR
        (c.creator_id = auth.uid() AND c.fan_id = profiles.id)
      )
    )
  )
);

-- Add audit log for this security fix
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_fix_profile_access_restricted',
  'profiles',
  NULL,
  jsonb_build_object(
    'issue', 'Removed overly permissive profile access policy',
    'fix_applied', 'Created conversation-based profile access policy',
    'security_improvement', 'Users can now only see profiles of conversation participants',
    'data_protected', 'email addresses, usernames, display names, bio information'
  )
);