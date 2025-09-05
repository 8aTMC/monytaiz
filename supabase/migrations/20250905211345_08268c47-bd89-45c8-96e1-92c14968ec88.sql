-- Add quality_info column to simple_media table to store quality variants
ALTER TABLE simple_media 
ADD COLUMN quality_info JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN simple_media.quality_info IS 'JSON object storing available quality variants: {"360p": {"width": 640, "height": 360, "path": "..."}, ...}';