-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Management can manage media collaborators" ON media_collaborators;

-- Create separate policies for read and write operations
-- Allow all authenticated users to read media collaborator data for filtering
CREATE POLICY "Authenticated users can view media collaborators" 
ON media_collaborators 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Restrict write operations to management only
CREATE POLICY "Management can manage media collaborators" 
ON media_collaborators 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);