-- Fix simple_media table RLS policies to allow management users to see all records
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Management can manage simple media" ON simple_media;
DROP POLICY IF EXISTS "Users can view their own simple media" ON simple_media;
DROP POLICY IF EXISTS "Fans can view processed simple media" ON simple_media;

-- Enable RLS on simple_media table
ALTER TABLE simple_media ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policy for management users (owner, superadmin, admin, manager, chatter)
CREATE POLICY "Management can manage simple media" 
ON simple_media 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

-- Create policy for fans to view only processed media they have access to
CREATE POLICY "Fans can view processed simple media" 
ON simple_media 
FOR SELECT 
USING (
  processing_status = 'processed' 
  AND (
    -- Fan has specific media grant
    EXISTS (
      SELECT 1 FROM fan_media_grants fmg 
      WHERE fmg.fan_id = auth.uid() 
      AND fmg.media_id = simple_media.id
    )
    -- Or fan has general access grant
    OR EXISTS (
      SELECT 1 FROM fan_media_grants fmg 
      WHERE fmg.fan_id = auth.uid() 
      AND fmg.media_id IS NULL
    )
  )
);