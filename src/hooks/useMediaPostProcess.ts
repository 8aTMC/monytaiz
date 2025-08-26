import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useMediaPostProcess = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const processMedia = async (bucket: string, path: string, isPublic = true) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('media-postprocess', {
        body: { bucket, path, isPublic },
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) {
        console.error('Media post-processing error:', error);
        toast({
          title: "Processing Warning",
          description: "Media uploaded but optimization failed",
          variant: "destructive"
        });
        return null;
      }

      if (data?.ok) {
        console.log('Media processed successfully:', data);
        return data;
      } else {
        console.warn('Post-processing completed with warnings:', data);
        return data;
      }
    } catch (error) {
      console.error('Media post-processing failed:', error);
      toast({
        title: "Processing Error",
        description: "Failed to optimize media for fast loading",
        variant: "destructive"
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  return {
    processMedia,
    processing
  };
};