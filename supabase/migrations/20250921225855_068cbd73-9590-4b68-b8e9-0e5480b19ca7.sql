-- Clean up orphaned collaborator mappings
DELETE FROM media_collaborators 
WHERE media_table = 'simple_media' 
AND media_id NOT IN (SELECT id FROM simple_media);

DELETE FROM media_collaborators 
WHERE media_table = 'media' 
AND media_id NOT IN (SELECT id FROM media);

DELETE FROM media_collaborators 
WHERE media_table = 'content_files' 
AND media_id NOT IN (SELECT id FROM content_files);