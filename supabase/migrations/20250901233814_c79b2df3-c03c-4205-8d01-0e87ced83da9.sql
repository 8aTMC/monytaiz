-- Update existing simple_media records to processed status so they show in library
UPDATE simple_media 
SET processing_status = 'processed', processed_at = now()
WHERE processing_status IN ('pending', 'processing');