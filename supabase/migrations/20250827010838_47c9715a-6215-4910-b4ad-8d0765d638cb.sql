-- Revert bucket to private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'content';

-- Remove public access policy
DROP POLICY IF EXISTS "Public read access for media files" ON storage.objects;