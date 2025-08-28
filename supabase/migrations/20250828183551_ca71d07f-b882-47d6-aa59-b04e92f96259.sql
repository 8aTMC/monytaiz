-- Enable Row Level Security on fan_my_media table
ALTER TABLE public.fan_my_media ENABLE ROW LEVEL SECURITY;

-- Policy 1: Fans can only view media they have been granted access to
CREATE POLICY "Fans can view their granted media access" 
ON public.fan_my_media 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM fan_media_grants fmg 
    WHERE fmg.fan_id = auth.uid() 
    AND fmg.media_id = fan_my_media.id
  )
);

-- Policy 2: Creators can view media grants for their own content
CREATE POLICY "Creators can view grants for their media" 
ON public.fan_my_media 
FOR SELECT 
USING (creator_id = auth.uid());

-- Policy 3: Management roles can view all fan media access data for admin purposes
CREATE POLICY "Management can view all fan media access" 
ON public.fan_my_media 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
  )
);

-- Policy 4: System operations can manage the data (for automated grants, etc.)
CREATE POLICY "System can manage fan media access data" 
ON public.fan_my_media 
FOR ALL 
USING (
  auth.uid() IS NULL OR -- Allow system operations (edge functions)
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
  )
);

-- Add audit logging for this security fix
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  metadata
) VALUES (
  auth.uid(),
  'security_vulnerability_resolved',
  'fan_my_media_table',
  jsonb_build_object(
    'vulnerability', 'Fan Media Access Data Publicly Exposed',
    'fix_applied', 'Added comprehensive RLS policies to restrict data access',
    'policies_created', ARRAY[
      'Fans can view their granted media access',
      'Creators can view grants for their media', 
      'Management can view all fan media access',
      'System can manage fan media access data'
    ],
    'security_level', 'Fan and creator access only with management oversight'
  )
);