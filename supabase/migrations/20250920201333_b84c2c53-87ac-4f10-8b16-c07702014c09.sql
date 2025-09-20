-- Populate media_collaborators table from existing mentions in simple_media
-- This will create proper relationships between media and collaborators

-- First, let's create a function to extract collaborator relationships
CREATE OR REPLACE FUNCTION populate_media_collaborators()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Insert relationships based on mentions in simple_media
  -- Handle both "@Name" and "Name" formats in mentions
  INSERT INTO media_collaborators (media_id, collaborator_id, media_table, creator_id, assigned_by, source)
  SELECT DISTINCT 
    sm.id as media_id,
    c.id as collaborator_id,
    'simple_media' as media_table,
    sm.creator_id,
    sm.creator_id as assigned_by,
    'auto_from_mentions' as source
  FROM simple_media sm
  CROSS JOIN collaborators c
  WHERE sm.mentions IS NOT NULL 
    AND array_length(sm.mentions, 1) > 0
    AND (
      -- Match exact name
      c.name = ANY(sm.mentions) 
      OR 
      -- Match name with @ prefix
      ('@' || c.name) = ANY(sm.mentions)
      OR
      -- Case insensitive match
      EXISTS (
        SELECT 1 FROM unnest(sm.mentions) as mention
        WHERE LOWER(mention) = LOWER(c.name) 
           OR LOWER(mention) = LOWER('@' || c.name)
      )
    )
  ON CONFLICT (media_id, collaborator_id, media_table) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Also populate from media table if it has mentions
  INSERT INTO media_collaborators (media_id, collaborator_id, media_table, creator_id, assigned_by, source)
  SELECT DISTINCT 
    m.id as media_id,
    c.id as collaborator_id,
    'media' as media_table,
    m.creator_id,
    m.creator_id as assigned_by,
    'auto_from_mentions' as source
  FROM media m
  CROSS JOIN collaborators c
  WHERE m.tags IS NOT NULL 
    AND array_length(m.tags, 1) > 0
    AND (
      -- Match exact name in tags (some mentions might be stored as tags)
      c.name = ANY(m.tags) 
      OR 
      -- Match name with @ prefix in tags
      ('@' || c.name) = ANY(m.tags)
      OR
      -- Case insensitive match in tags
      EXISTS (
        SELECT 1 FROM unnest(m.tags) as tag
        WHERE LOWER(tag) = LOWER(c.name) 
           OR LOWER(tag) = LOWER('@' || c.name)
      )
    )
  ON CONFLICT (media_id, collaborator_id, media_table) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'inserted_relationships', inserted_count,
    'message', format('Populated %s media-collaborator relationships', inserted_count)
  );
END;
$function$;

-- Execute the function to populate the relationships
SELECT populate_media_collaborators();