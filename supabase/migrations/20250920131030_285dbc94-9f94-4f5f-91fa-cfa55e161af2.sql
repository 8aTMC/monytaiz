-- Clean up saved_tags table to only include tags that actually exist on media files
-- This prevents the filter dialog from showing tags that don't exist on any media

-- Step 1: Delete saved_tags entries that don't exist on any media files
DELETE FROM saved_tags 
WHERE tag_name NOT IN (
  -- Get all unique tags from media table
  SELECT DISTINCT unnest(tags) as tag_name 
  FROM media 
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  
  UNION
  
  -- Get all unique tags from simple_media table
  SELECT DISTINCT unnest(tags) as tag_name 
  FROM simple_media 
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  
  UNION
  
  -- Get all unique tags from content_files table
  SELECT DISTINCT unnest(tags) as tag_name 
  FROM content_files 
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
);

-- Step 2: Update usage counts for remaining tags based on actual media usage
UPDATE saved_tags 
SET 
  usage_count = (
    -- Count from media table
    (SELECT COUNT(*) FROM media WHERE tags @> ARRAY[saved_tags.tag_name]) +
    -- Count from simple_media table  
    (SELECT COUNT(*) FROM simple_media WHERE tags @> ARRAY[saved_tags.tag_name]) +
    -- Count from content_files table
    (SELECT COUNT(*) FROM content_files WHERE tags @> ARRAY[saved_tags.tag_name])
  ),
  last_used_at = now()
WHERE tag_name IN (
  SELECT tag_name FROM saved_tags
);

-- Step 3: Insert any missing tags that exist on media but not in saved_tags
INSERT INTO saved_tags (tag_name, usage_count, creator_id, last_used_at)
SELECT 
  tag_name,
  usage_count,
  (SELECT id FROM profiles WHERE deletion_status = 'active' LIMIT 1) as creator_id,
  now() as last_used_at
FROM (
  -- Get all tags with usage counts from all media tables
  SELECT 
    tag_name,
    COUNT(*) as usage_count
  FROM (
    SELECT unnest(tags) as tag_name FROM media WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    UNION ALL
    SELECT unnest(tags) as tag_name FROM simple_media WHERE tags IS NOT NULL AND array_length(tags, 1) > 0  
    UNION ALL
    SELECT unnest(tags) as tag_name FROM content_files WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  ) all_tags
  WHERE tag_name IS NOT NULL AND tag_name != ''
  GROUP BY tag_name
) media_tag_counts
WHERE tag_name NOT IN (SELECT tag_name FROM saved_tags)
ON CONFLICT (tag_name, creator_id) DO UPDATE SET
  usage_count = EXCLUDED.usage_count,
  last_used_at = now();