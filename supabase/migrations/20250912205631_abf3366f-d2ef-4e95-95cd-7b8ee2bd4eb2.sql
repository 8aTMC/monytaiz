-- Backfill existing GIF records that were converted to WebP
-- This updates metadata for UI recognition but animation requires re-upload

-- Update simple_media records where original_filename ends with .gif
-- but mime_type is not image/gif (these were converted during upload)
UPDATE simple_media 
SET 
  media_type = 'gif',
  mime_type = 'image/gif',
  updated_at = NOW()
WHERE 
  original_filename ILIKE '%.gif'
  AND mime_type != 'image/gif'
  AND mime_type = 'image/webp';

-- Add a comment for future reference
COMMENT ON COLUMN simple_media.media_type IS 'Media type: image, video, audio, gif. GIF files preserve animation when uploaded correctly.';