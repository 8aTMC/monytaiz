-- Make the content bucket public for faster image loading
UPDATE storage.buckets 
SET public = true 
WHERE id = 'content';