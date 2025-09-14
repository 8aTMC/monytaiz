-- Add support for large video processing queue status
ALTER TYPE processing_status_enum ADD VALUE IF NOT EXISTS 'queued_for_processing';