-- Clean up legacy folder tags from simple_media table
UPDATE simple_media 
SET tags = array_remove(tags, tag)
FROM unnest(tags) AS tag
WHERE tag LIKE 'folder:%';

-- Alternative approach to clean all folder tags at once
UPDATE simple_media 
SET tags = ARRAY(
  SELECT unnest(tags) 
  WHERE unnest(tags) NOT LIKE 'folder:%'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) AS tag WHERE tag LIKE 'folder:%'
);