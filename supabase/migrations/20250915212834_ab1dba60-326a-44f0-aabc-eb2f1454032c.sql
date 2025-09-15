-- Clean up duplicate saved_tags and add unique constraint
WITH duplicate_cleanup AS (
  -- Find duplicates and keep the one with highest usage_count and most recent last_used_at
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY creator_id, LOWER(tag_name) 
      ORDER BY usage_count DESC, last_used_at DESC
    ) as rn,
    creator_id,
    tag_name
  FROM saved_tags
),
consolidation AS (
  -- Calculate total usage count for each unique tag
  SELECT 
    creator_id,
    LOWER(tag_name) as tag_key,
    SUM(usage_count) as total_usage,
    MAX(last_used_at) as latest_used,
    MIN(created_at) as earliest_created
  FROM saved_tags
  GROUP BY creator_id, LOWER(tag_name)
  HAVING COUNT(*) > 1
)
-- First, update the record we're keeping with consolidated usage count
UPDATE saved_tags 
SET 
  usage_count = c.total_usage,
  last_used_at = c.latest_used,
  created_at = c.earliest_created
FROM consolidation c, duplicate_cleanup dc
WHERE saved_tags.id = dc.id 
  AND dc.rn = 1 
  AND dc.creator_id = c.creator_id 
  AND LOWER(dc.tag_name) = c.tag_key;

-- Delete duplicate records (keep only the first one from each group)
DELETE FROM saved_tags 
WHERE id IN (
  SELECT id 
  FROM duplicate_cleanup 
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE saved_tags 
ADD CONSTRAINT unique_tag_per_creator 
UNIQUE (creator_id, tag_name);