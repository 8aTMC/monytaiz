-- Add missing DELETE policy to media_analytics table
-- This allows management users to delete analytics data, which is needed for the "Restore Real Data" functionality

CREATE POLICY "Management can delete media analytics" 
ON public.media_analytics 
FOR DELETE 
USING (EXISTS ( 
  SELECT 1 
  FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role])
));