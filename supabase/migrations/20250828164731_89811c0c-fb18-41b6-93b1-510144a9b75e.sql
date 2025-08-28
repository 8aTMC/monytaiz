-- Fix media paths for existing records that have incorrect flat structure paths
-- Update paths to use the correct nested folder structure where files are actually stored

UPDATE media 
SET 
  path = CASE 
    WHEN type = 'image' AND path LIKE 'processed/%.webp' AND path NOT LIKE 'processed/%/image.webp' 
    THEN REPLACE(path, '.webp', '/image.webp')
    WHEN type = 'video' AND path LIKE 'processed/%.mp4' AND path NOT LIKE 'processed/%/video.mp4'
    THEN REPLACE(path, '.mp4', '/video.mp4') 
    ELSE path
  END,
  storage_path = CASE 
    WHEN type = 'image' AND storage_path LIKE 'processed/%.webp' AND storage_path NOT LIKE 'processed/%/image.webp'
    THEN REPLACE(storage_path, '.webp', '/image.webp')
    WHEN type = 'video' AND storage_path LIKE 'processed/%.mp4' AND storage_path NOT LIKE 'processed/%/video.mp4' 
    THEN REPLACE(storage_path, '.mp4', '/video.mp4')
    ELSE storage_path
  END
WHERE 
  processing_status = 'done' 
  AND (
    (type = 'image' AND (path LIKE 'processed/%.webp' AND path NOT LIKE 'processed/%/image.webp'))
    OR 
    (type = 'video' AND (path LIKE 'processed/%.mp4' AND path NOT LIKE 'processed/%/video.mp4'))
    OR
    (type = 'image' AND (storage_path LIKE 'processed/%.webp' AND storage_path NOT LIKE 'processed/%/image.webp'))
    OR
    (type = 'video' AND (storage_path LIKE 'processed/%.mp4' AND storage_path NOT LIKE 'processed/%/video.mp4'))
  );