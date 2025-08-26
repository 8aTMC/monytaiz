-- Create function to clean up corrupted media records
CREATE OR REPLACE FUNCTION public.cleanup_corrupted_media()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  corrupted_count INTEGER := 0;
BEGIN
  -- Delete media records that have missing essential data
  DELETE FROM media 
  WHERE type IS NULL 
     OR type = '' 
     OR storage_path IS NULL 
     OR storage_path = '' 
     OR size_bytes = 0 
     OR size_bytes IS NULL;
  
  GET DIAGNOSTICS corrupted_count = ROW_COUNT;
  
  -- Also clean up content_files with similar issues
  DELETE FROM content_files 
  WHERE file_path IS NULL 
     OR file_path = '' 
     OR file_size = 0 
     OR file_size IS NULL 
     OR content_type IS NULL;
  
  RETURN json_build_object(
    'success', true,
    'deleted_media_records', corrupted_count,
    'message', format('Cleaned up %s corrupted media records', corrupted_count)
  );
END;
$$;