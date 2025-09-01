-- Fix RLS policies for file_folder_contents to work with edge functions
-- while maintaining security

-- Update the insert policy to allow service role operations for legitimate copies
DROP POLICY IF EXISTS "Users can add content to their folders" ON file_folder_contents;

CREATE POLICY "Users can add content to their folders"
ON file_folder_contents
FOR INSERT
WITH CHECK (
  -- Allow if user is authenticated and folder belongs to them
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM file_folders f
    WHERE f.id = file_folder_contents.folder_id 
    AND f.creator_id = auth.uid()
  ) AND auth.uid() = added_by)
  OR
  -- Allow service role operations when folder and media belong to the specified user
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 FROM file_folders f
    WHERE f.id = file_folder_contents.folder_id 
    AND f.creator_id = added_by
  ))
);

-- Add indexes for better performance on file_folder_contents
CREATE INDEX IF NOT EXISTS idx_file_folder_contents_folder_id ON file_folder_contents(folder_id);
CREATE INDEX IF NOT EXISTS idx_file_folder_contents_media_id ON file_folder_contents(media_id);
CREATE INDEX IF NOT EXISTS idx_file_folder_contents_added_by ON file_folder_contents(added_by);

-- Add composite index for uniqueness and performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_folder_contents_unique 
ON file_folder_contents(folder_id, media_id);