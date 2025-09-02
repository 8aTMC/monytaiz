-- Fix existing video thumbnail paths to match actual storage structure
-- Remove UUID prefix from thumbnail paths to match actual file naming convention

UPDATE simple_media 
SET thumbnail_path = 'thumbnails/' || title || '_thumb.jpg'
WHERE media_type = 'video' 
AND thumbnail_path IS NOT NULL 
AND thumbnail_path LIKE 'thumbnails/%-%_thumb.jpg';