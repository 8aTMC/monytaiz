-- Clean up orphaned collections data to fix folder inconsistency
-- This removes collections that are not in the file_folders table
DELETE FROM collections 
WHERE NOT EXISTS (
  SELECT 1 FROM file_folders 
  WHERE file_folders.name = collections.name
);

-- Clean up any collection_items that reference deleted collections
DELETE FROM collection_items 
WHERE collection_id NOT IN (
  SELECT id FROM collections
);