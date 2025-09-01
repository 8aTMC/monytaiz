-- Clean up legacy folder tags from simple_media table
UPDATE simple_media 
SET tags = ARRAY(
  SELECT tag 
  FROM unnest(tags) AS tag 
  WHERE tag NOT LIKE 'folder:%'
)
WHERE tags && ARRAY(
  SELECT tag 
  FROM unnest(tags) AS tag 
  WHERE tag LIKE 'folder:%'
);