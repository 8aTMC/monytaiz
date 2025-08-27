-- Delete duplicate media records that already exist in content_files
-- These were created by the edge function and are causing double counting
DELETE FROM media 
WHERE id IN (
  SELECT m.id 
  FROM media m
  INNER JOIN content_files cf ON m.id = cf.id
  WHERE m.origin = 'upload'
);