-- Create index for faster collaborator filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_collaborators_collaborator_media 
ON media_collaborators(collaborator_id, media_id, media_table);

-- Function to refresh media collaborators mappings
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
  
  -- Process media table
  FOR media_record IN 
    SELECT id, title, notes, tags, creator_id 
    FROM media 
    WHERE tags IS NOT NULL OR notes IS NOT NULL OR title IS NOT NULL
  LOOP
    FOR collaborator_record IN 
      SELECT c.id as collaborator_id, c.name, c.username
      FROM collaborators c
      WHERE 
        -- Match by title, notes, or tags (case insensitive)
        (media_record.title IS NOT NULL AND 
         (LOWER(media_record.title) LIKE '%' || LOWER(c.name) || '%' 
          OR LOWER(media_record.title) LIKE '%' || LOWER(c.username) || '%'))
        OR
        (media_record.notes IS NOT NULL AND 
         (LOWER(media_record.notes) LIKE '%' || LOWER(c.name) || '%' 
          OR LOWER(media_record.notes) LIKE '%' || LOWER(c.username) || '%'))
        OR
        (media_record.tags IS NOT NULL AND 
         EXISTS (
           SELECT 1 FROM unnest(media_record.tags) as tag
           WHERE LOWER(tag) LIKE '%' || LOWER(c.name) || '%' 
              OR LOWER(tag) LIKE '%' || LOWER(c.username) || '%'
         ))
    LOOP
      INSERT INTO media_collaborators (
        media_id, collaborator_id, media_table, creator_id, assigned_by, source
      ) VALUES (
        media_record.id, collaborator_record.collaborator_id, 'media',
        media_record.creator_id, media_record.creator_id, 'auto'
      ) ON CONFLICT (media_id, collaborator_id, media_table) DO NOTHING;
      
      inserted_count := inserted_count + 1;
    END LOOP;
  END LOOP;
  
  -- Process content_files table
  FOR media_record IN 
    SELECT id, title, description, tags, creator_id 
    FROM content_files 
    WHERE tags IS NOT NULL OR description IS NOT NULL OR title IS NOT NULL
  LOOP
    FOR collaborator_record IN 
      SELECT c.id as collaborator_id, c.name, c.username
      FROM collaborators c
      WHERE 
        -- Match by title, description, or tags (case insensitive)
        (media_record.title IS NOT NULL AND 
         (LOWER(media_record.title) LIKE '%' || LOWER(c.name) || '%' 
          OR LOWER(media_record.title) LIKE '%' || LOWER(c.username) || '%'))
        OR
        (media_record.description IS NOT NULL AND 
         (LOWER(media_record.description) LIKE '%' || LOWER(c.name) || '%' 
          OR LOWER(media_record.description) LIKE '%' || LOWER(c.username) || '%'))
        OR
        (media_record.tags IS NOT NULL AND 
         EXISTS (
           SELECT 1 FROM unnest(media_record.tags) as tag
           WHERE LOWER(tag) LIKE '%' || LOWER(c.name) || '%' 
              OR LOWER(tag) LIKE '%' || LOWER(c.username) || '%'
         ))
    LOOP
      INSERT INTO media_collaborators (
        media_id, collaborator_id, media_table, creator_id, assigned_by, source
      ) VALUES (
        media_record.id, collaborator_record.collaborator_id, 'content_files',
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