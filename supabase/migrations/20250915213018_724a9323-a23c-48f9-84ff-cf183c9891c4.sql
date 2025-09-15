-- 1) Consolidate duplicate tags per (creator_id, tag_name)
WITH ranked AS (
  SELECT 
    id,
    creator_id,
    tag_name,
    usage_count,
    last_used_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY creator_id, tag_name 
      ORDER BY usage_count DESC, last_used_at DESC, created_at ASC
    ) AS rn
  FROM saved_tags
), agg AS (
  SELECT 
    creator_id,
    tag_name,
    SUM(usage_count) AS total_usage,
    MAX(last_used_at) AS latest_used,
    MIN(created_at) AS earliest_created
  FROM saved_tags
  GROUP BY creator_id, tag_name
  HAVING COUNT(*) > 1
)
UPDATE saved_tags s
SET 
  usage_count = a.total_usage,
  last_used_at = a.latest_used,
  created_at = a.earliest_created
FROM agg a
JOIN ranked r 
  ON r.creator_id = a.creator_id 
  AND r.tag_name = a.tag_name 
  AND r.rn = 1
WHERE s.id = r.id;

-- 2) Delete the duplicate rows (keep rn = 1)
WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY creator_id, tag_name 
      ORDER BY usage_count DESC, last_used_at DESC, created_at ASC
    ) AS rn
  FROM saved_tags
)
DELETE FROM saved_tags 
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Add a unique constraint to prevent future duplicates (case-sensitive)
ALTER TABLE saved_tags 
ADD CONSTRAINT unique_tag_per_creator UNIQUE (creator_id, tag_name);