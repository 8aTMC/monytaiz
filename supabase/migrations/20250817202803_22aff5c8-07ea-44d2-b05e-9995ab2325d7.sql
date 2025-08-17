-- Fix security issue: Restrict profile visibility to authenticated users only
-- Remove the overly permissive policy that allows anonymous access
DROP POLICY IF EXISTS "Active profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that requires authentication to view active profiles
CREATE POLICY "Authenticated users can view active profiles" 
ON public.profiles 
FOR SELECT 
USING (
  deletion_status = 'active'::text 
  AND auth.uid() IS NOT NULL
);

-- Ensure users can still view their own profile even if not active (for account management)
CREATE POLICY "Users can view their own profile regardless of status" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);