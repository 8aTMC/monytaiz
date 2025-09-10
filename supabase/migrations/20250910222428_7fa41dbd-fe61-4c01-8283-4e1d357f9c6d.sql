-- Fix stuck video processing records and create admin function to handle future occurrences
-- Update all stuck processing records to processed status
UPDATE simple_media 
SET processing_status = 'processed', 
    processed_at = NOW(),
    updated_at = NOW()
WHERE processing_status = 'processing' 
  AND media_type = 'video' 
  AND processed_path IS NOT NULL 
  AND processed_path != '';

-- Create admin function to fix stuck processing videos
CREATE OR REPLACE FUNCTION public.fix_stuck_video_processing()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Update stuck video processing records that have processed_path but wrong status
  UPDATE simple_media 
  SET 
    processing_status = 'processed',
    processed_at = COALESCE(processed_at, NOW()),
    updated_at = NOW()
  WHERE processing_status IN ('processing', 'pending')
    AND media_type = 'video'
    AND (processed_path IS NOT NULL AND processed_path != '');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'updated_videos', updated_count,
    'message', format('Fixed %s stuck video processing records', updated_count)
  );
END;
$function$;