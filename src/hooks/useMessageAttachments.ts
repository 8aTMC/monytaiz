import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDirectMedia } from '@/hooks/useDirectMedia';

interface MessageFile {
  id: string;
  type: string;
  name: string;
  url?: string;
  preview?: string;
  size: number;
  locked: boolean;
  price?: number;
  media_table?: string;
}

interface AttachmentData {
  id: string;
  media_id: string;
  media_table: string;
  file_order: number;
  // Media file data (from simple_media or content_files)
  title?: string;
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
  file_path?: string;
  storage_path?: string;
  suggested_price_cents?: number;
  base_price?: number;
}

export const useMessageAttachments = (messageId?: string) => {
  const [attachments, setAttachments] = useState<MessageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getDirectUrl } = useDirectMedia();

  useEffect(() => {
    if (!messageId) {
      setAttachments([]);
      return;
    }

    const fetchAttachments = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get attachment records
        const { data: attachmentRecords, error: attachmentError } = await supabase
          .from('message_file_attachments')
          .select('*')
          .eq('message_id', messageId)
          .order('file_order');

        if (attachmentError) throw attachmentError;
        if (!attachmentRecords || attachmentRecords.length === 0) {
          setAttachments([]);
          return;
        }

        // Group by media table to fetch efficiently
        const simpleMediaIds = attachmentRecords
          .filter(r => r.media_table === 'simple_media')
          .map(r => r.media_id);
        
        const contentFileIds = attachmentRecords
          .filter(r => r.media_table === 'content_files')
          .map(r => r.media_id);

        // Fetch from both tables
        const results = await Promise.all([
          simpleMediaIds.length > 0 
            ? supabase.from('simple_media').select('*').in('id', simpleMediaIds)
            : Promise.resolve({ data: [], error: null }),
          contentFileIds.length > 0 
            ? supabase.from('content_files').select('*').in('id', contentFileIds)
            : Promise.resolve({ data: [], error: null })
        ]);

        const [simpleMediaData, contentFileData] = results;

        if (simpleMediaData.error) throw simpleMediaData.error;
        if (contentFileData.error) throw contentFileData.error;

        // Create lookup maps
        const simpleMediaMap = new Map(
          (simpleMediaData.data || []).map(item => [item.id, { ...item, table: 'simple_media' }])
        );
        const contentFileMap = new Map(
          (contentFileData.data || []).map(item => [item.id, { ...item, table: 'content_files' }])
        );

        // Transform to MessageFile format with proper ordering
        const transformedFiles: MessageFile[] = [];
        
        for (const record of attachmentRecords) {
          const mediaData = record.media_table === 'simple_media' 
            ? simpleMediaMap.get(record.media_id)
            : contentFileMap.get(record.media_id);

          if (mediaData) {
            // Determine file type from mime_type or file_path
            const mimeType = mediaData.mime_type || '';
            const fileName = mediaData.original_filename || mediaData.title || `file-${record.file_order}`;
            
            // Get correct file paths based on media table
            let filePath = '';
            let thumbnailPath = '';
            
            if (record.media_table === 'simple_media') {
              filePath = mediaData.processed_path || mediaData.original_path || '';
              thumbnailPath = mediaData.thumbnail_path || '';
            } else {
              filePath = mediaData.file_path || '';  
              thumbnailPath = mediaData.thumbnail_url || '';
            }
            
            let type = 'document';
            if (mimeType.startsWith('image/') || filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              type = 'image';
            } else if (mimeType.startsWith('video/') || filePath.match(/\.(mp4|mov|avi|webm)$/i)) {
              type = 'video';
            } else if (mimeType.startsWith('audio/') || filePath.match(/\.(mp3|wav|ogg|m4a)$/i)) {
              type = 'audio';
            }

            // Get secure URLs
            let url: string | undefined;
            let preview: string | undefined;
            
            if (filePath) {
              try {
                url = await getDirectUrl(filePath);
                
                // For videos, use thumbnail if available, otherwise use main URL
                if (type === 'video' && thumbnailPath) {
                  preview = await getDirectUrl(thumbnailPath);
                } else if (type === 'image') {
                  preview = url;
                }
              } catch (urlError) {
                console.warn('Failed to get secure URL for:', filePath, urlError);
              }
            }

            // Determine pricing and lock status
            const priceAmount = record.media_table === 'content_files' 
              ? mediaData.base_price 
              : mediaData.suggested_price_cents;
            
            const price = priceAmount ? (typeof priceAmount === 'number' ? priceAmount / 100 : 0) : 0;
            const locked = price > 0; // For now, assume any priced content is locked

            transformedFiles.push({
              id: mediaData.id,
              type,
              name: fileName,
              url,
              preview,
              size: mediaData.file_size || 0,
              locked,
              price,
              media_table: record.media_table
            });
          }
        }

        // Sort files: images first, then videos, then audio, then documents
        const typeOrder = { image: 0, video: 1, audio: 2, document: 3 };
        transformedFiles.sort((a, b) => typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder]);

        setAttachments(transformedFiles);
      } catch (err) {
        console.error('Error fetching message attachments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load attachments');
        setAttachments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttachments();
  }, [messageId, getDirectUrl]);

  return { attachments, loading, error };
};