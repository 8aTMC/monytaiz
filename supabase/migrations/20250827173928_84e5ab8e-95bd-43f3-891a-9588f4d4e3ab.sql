-- Add content_file_id column to collection_items table
ALTER TABLE collection_items ADD COLUMN content_file_id UUID REFERENCES content_files(id) ON DELETE CASCADE;

-- Make media_id nullable since we now support both media and content_files
ALTER TABLE collection_items ALTER COLUMN media_id DROP NOT NULL;

-- Add constraint to ensure either media_id or content_file_id is provided, but not both
ALTER TABLE collection_items ADD CONSTRAINT check_media_or_content_file 
CHECK ((media_id IS NOT NULL AND content_file_id IS NULL) OR (media_id IS NULL AND content_file_id IS NOT NULL));

-- Update unique constraint to include content_file_id
ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_collection_id_media_id_key;
CREATE UNIQUE INDEX collection_items_unique_media 
ON collection_items (collection_id, media_id) 
WHERE media_id IS NOT NULL;

CREATE UNIQUE INDEX collection_items_unique_content_file 
ON collection_items (collection_id, content_file_id) 
WHERE content_file_id IS NOT NULL;