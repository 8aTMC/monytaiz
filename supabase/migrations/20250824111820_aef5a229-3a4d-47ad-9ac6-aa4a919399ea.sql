-- Clean up duplicate "Welcome Pack" folders, keeping only the most recent one
DELETE FROM collections 
WHERE name = 'Welcome Pack' 
AND id NOT IN (
  SELECT id FROM collections 
  WHERE name = 'Welcome Pack' 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Add unique constraint to prevent duplicate folder names per creator
ALTER TABLE collections 
ADD CONSTRAINT unique_collection_name_per_creator 
UNIQUE (creator_id, name);