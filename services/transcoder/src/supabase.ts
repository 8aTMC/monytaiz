import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function downloadFile(bucket: string, path: string): Promise<ArrayBuffer> {
  logger.info('Downloading file from storage', { bucket, path });
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);
    
  if (error) {
    logger.error('Storage download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('No data received from storage');
  }
  
  return data.arrayBuffer();
}

export async function uploadFile(
  bucket: string, 
  path: string, 
  buffer: Buffer, 
  contentType: string
): Promise<string> {
  logger.info('Uploading file to storage', { bucket, path, contentType, size: buffer.length });
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      upsert: true,
      contentType
    });
    
  if (error) {
    logger.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  logger.info('File uploaded successfully', { path: data.path });
  return data.path;
}

export async function updateMediaRecord(
  mediaId: string, 
  updates: {
    processing_status: string;
    processed_path?: string;
    thumbnail_path?: string;
    width?: number;
    height?: number;
    duration_seconds?: number;
    optimized_size_bytes?: number;
    processed_at?: string;
    processing_error?: string;
  }
): Promise<void> {
  logger.info('Updating media record', { mediaId, updates });
  
  const { error } = await supabase
    .from('simple_media')
    .update(updates)
    .eq('id', mediaId);
    
  if (error) {
    logger.error('Database update error:', error);
    throw new Error(`Failed to update media record: ${error.message}`);
  }
  
  logger.info('Media record updated successfully', { mediaId });
}