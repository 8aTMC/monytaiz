
-- Create the processed folder by inserting a placeholder file
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES (
  'content',
  'processed/.gitkeep',
  auth.uid(),
  '{"size": 56, "mimetype": "text/plain", "cacheControl": "max-age=3600"}'::jsonb
);

-- Create the thumbnails folder by inserting a placeholder file  
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES (
  'content', 
  'thumbnails/.gitkeep',
  auth.uid(),
  '{"size": 56, "mimetype": "text/plain", "cacheControl": "max-age=3600"}'::jsonb
);

-- Delete any files in the uploads folder (cleanup)
DELETE FROM storage.objects 
WHERE bucket_id = 'content' 
AND name LIKE 'uploads/%';
