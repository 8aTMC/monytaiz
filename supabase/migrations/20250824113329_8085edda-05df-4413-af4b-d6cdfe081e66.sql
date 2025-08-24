-- Clean up duplicate folders in file_folders table, keeping only the most recent one for each name per creator
DELETE FROM file_folders 
WHERE id NOT IN (
  SELECT DISTINCT ON (creator_id, name) id
  FROM file_folders 
  ORDER BY creator_id, name, created_at DESC
);

-- Add unique constraint to file_folders table to prevent duplicate folder names per creator
ALTER TABLE file_folders 
ADD CONSTRAINT unique_file_folder_name_per_creator 
UNIQUE (creator_id, name);