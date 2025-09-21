-- Recreate collaborator mappings based on mentions and tags
WITH collaborator_data AS (
  SELECT id, name, username FROM collaborators
),
media_matches AS (
  SELECT DISTINCT
    sm.id as media_id,
    c.id as collaborator_id,
    sm.creator_id,
    'simple_media' as media_table
  FROM simple_media sm
  CROSS JOIN collaborator_data c
  WHERE 
    -- Match mentions (exact username/name match)
    (sm.mentions IS NOT NULL AND (
      sm.mentions::text ILIKE '%' || c.name || '%' OR
      (c.username IS NOT NULL AND sm.mentions::text ILIKE '%' || c.username || '%')
    ))
    OR
    -- Match tags (partial name match)
    (sm.tags IS NOT NULL AND (
      sm.tags::text ILIKE '%' || c.name || '%' OR
      (c.username IS NOT NULL AND sm.tags::text ILIKE '%' || c.username || '%')
    ))
)
INSERT INTO media_collaborators (media_id, collaborator_id, media_table, creator_id, assigned_by, source)
SELECT 
  mm.media_id,
  mm.collaborator_id,
  mm.media_table,
  mm.creator_id,
  mm.creator_id as assigned_by,
  'auto' as source
FROM media_matches mm
ON CONFLICT (media_id, collaborator_id, media_table) DO NOTHING;