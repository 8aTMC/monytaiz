-- Fix the function search path security issue
DROP FUNCTION IF EXISTS refresh_media_collaborators();

CREATE OR REPLACE FUNCTION refresh_media_collaborators()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer := 0;
  media_record record;
  collaborator_record record;
BEGIN
  -- Clear existing auto-generated mappings to rebuild fresh
  DELETE FROM media_collaborators WHERE source = 'auto';
  
  -- Process simple_media table
  FOR media_record IN 
    SELECT id, title, mentions, tags, creator_id 
    FROM simple_media 
    WHERE mentions IS NOT NULL OR tags IS NOT NULL
  LOOP
    -- Match against collaborators by mentions and tags
    FOR collaborator_record IN 
      SELECT c.id as collaborator_id, c.name, c.username
      FROM collaborators c
      WHERE 
        -- Match by mentions (exact match)
        (media_record.mentions IS NOT NULL AND 
         (c.username = ANY(media_record.mentions) OR c.name = ANY(media_record.mentions)))
        OR
        -- Match by tags (case insensitive)
        (media_record.tags IS NOT NULL AND 
         EXISTS (
           SELECT 1 FROM unnest(media_record.tags) as tag
           WHERE LOWER(tag) LIKE '%' || LOWER(c.name) || '%' 
              OR LOWER(tag) LIKE '%' || LOWER(c.username) || '%'
         ))
    LOOP
      -- Insert mapping if it doesn't exist
      INSERT INTO media_collaborators (
        media_id, collaborator_id, media_table, creator_id, assigned_by, source
      ) VALUES (
        media_record.id, collaborator_record.collaborator_id, 'simple_media',
        media_record.creator_id, media_record.creator_id, 'auto'
      ) ON CONFLICT (media_id, collaborator_id, media_table) DO NOTHING;
      
      inserted_count := inserted_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'inserted_mappings', inserted_count,
    'message', format('Refreshed media collaborators mappings, created %s new mappings', inserted_count)
  );
END;
$$;