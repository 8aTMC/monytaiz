-- Update RLS policy for collaborators table to allow read access for all authenticated users
-- while keeping write operations restricted to management users

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Management can manage collaborators" ON public.collaborators;

-- Create separate policies for read and write operations
CREATE POLICY "Authenticated users can view collaborators" 
ON public.collaborators 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Management can manage collaborators" 
ON public.collaborators 
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role)
));