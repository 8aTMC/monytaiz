-- First, add 'gif' as a valid media_type value
-- Check current constraint and add gif if it doesn't exist
DO $$ 
BEGIN
  -- Try to add gif to the media_type check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'simple_media_media_type_check'
    AND check_clause LIKE '%gif%'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE simple_media DROP CONSTRAINT IF EXISTS simple_media_media_type_check;
    
    -- Add new constraint with gif included
    ALTER TABLE simple_media ADD CONSTRAINT simple_media_media_type_check 
    CHECK (media_type IN ('image', 'video', 'audio', 'gif'));
  END IF;
END $$;

-- Now update existing GIF records that were converted to WebP
UPDATE simple_media 
SET 
  media_type = 'gif',
  mime_type = 'image/gif',
  updated_at = NOW()
WHERE 
  original_filename ILIKE '%.gif'
  AND mime_type != 'image/gif'
  AND mime_type = 'image/webp';

-- Add comment for reference
COMMENT ON COLUMN simple_media.media_type IS 'Media type: image, video, audio, gif. GIF files preserve animation when uploaded correctly.';