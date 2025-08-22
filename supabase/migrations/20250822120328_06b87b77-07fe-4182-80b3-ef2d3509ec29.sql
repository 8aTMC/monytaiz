-- Fix the security definer view by removing it and using a regular view with proper RLS
DROP VIEW IF EXISTS fan_my_media;

-- Create a regular view without security definer
CREATE VIEW fan_my_media AS
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
  JOIN media m ON m.id = g.media_id;

-- Add RLS policy for the view  
CREATE POLICY "Fans can view their granted media via view" ON fan_media_grants
  FOR SELECT USING (
    fan_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'fan'
    )
  );