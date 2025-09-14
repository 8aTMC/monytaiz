-- Remove video processing and quality metadata
-- Update all videos to 'uploaded' status since we're not processing anymore
UPDATE simple_media 
SET processing_status = 'uploaded', processed_at = NOW()
WHERE media_type = 'video' AND processing_status IN ('processing', 'pending', 'queued_for_processing');

-- Remove quality metadata table since we're not generating quality levels anymore
DROP TABLE IF EXISTS quality_metadata CASCADE;

-- Clean up processing-related columns from simple_media if they exist
-- Note: We'll keep the columns for backwards compatibility but they won't be used
UPDATE simple_media 
SET quality_info = NULL, processed_path = NULL
WHERE media_type = 'video';