-- Make the content bucket public for direct access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'content';

-- Update storage policies to allow public read access for media files
CREATE POLICY "Public read access for media files" ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'content');