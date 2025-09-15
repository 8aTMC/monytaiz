-- Create a cleanup function to remove orphaned duplicate entries
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_duplicates()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleanup_count INTEGER := 0;
  total_cleaned INTEGER := 0;
BEGIN
  -- Clean up content_files that don't exist in storage or are inactive
  DELETE FROM content_files 
  WHERE is_active = false OR file_path IS NULL OR file_path = '';
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up files that are inactive
  DELETE FROM files 
  WHERE is_active = false OR file_path IS NULL OR file_path = '';
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up simple_media with processing errors or no paths
  DELETE FROM simple_media 
  WHERE processing_status = 'error' 
     OR (original_path IS NULL AND processed_path IS NULL);
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up orphaned collection_items that reference non-existent media
  DELETE FROM collection_items 
  WHERE media_id NOT IN (
    SELECT id FROM simple_media 
    UNION 
    SELECT id FROM media 
    UNION 
    SELECT id FROM content_files
  );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up orphaned file_folder_contents
  DELETE FROM file_folder_contents 
  WHERE media_id NOT IN (
    SELECT id FROM simple_media 
    UNION 
    SELECT id FROM media 
    UNION 
    SELECT id FROM content_files
  );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up orphaned fan_media_grants
  DELETE FROM fan_media_grants 
  WHERE media_id IS NOT NULL 
    AND media_id NOT IN (
      SELECT id FROM simple_media 
      UNION 
      SELECT id FROM media 
      UNION 
      SELECT id FROM content_files
    );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  -- Clean up orphaned processing_jobs
  DELETE FROM processing_jobs 
  WHERE media_id NOT IN (
    SELECT id FROM simple_media 
    UNION 
    SELECT id FROM media 
    UNION 
    SELECT id FROM content_files
  );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  total_cleaned := total_cleaned + cleanup_count;
  
  RETURN json_build_object(
    'success', true,
    'total_cleaned', total_cleaned,
    'message', format('Cleaned up %s orphaned records', total_cleaned)
  );
END;
$$;