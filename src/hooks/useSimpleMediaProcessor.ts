import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSimpleMediaProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const processSimpleMedia = async (mediaId: string, originalPath: string, mimeType: string, mediaType: 'image' | 'video' | 'audio' | 'gif') => {
    setProcessing(true);
    try {
      console.log(`Processing simple media: ${mediaId} (${mediaType})`);
      
      const { data, error } = await supabase.functions.invoke('media-optimizer', {
        body: { mediaId, originalPath, mimeType, mediaType },
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) {
        console.error('Simple media processing error:', error);
        toast({
          title: "Processing Error",
          description: "Failed to process media file",
          variant: "destructive"
        });
        return false;
      }

      if (data?.success) {
        console.log('Simple media processed successfully:', data);
        toast({
          title: "Processing Complete",
          description: "Media file processed successfully",
        });
        return true;
      } else {
        console.warn('Processing completed with warnings:', data);
        return false;
      }
    } catch (error) {
      console.error('Simple media processing failed:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process media file",
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  return {
    processSimpleMedia,
    processing
  };
};