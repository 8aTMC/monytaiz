import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HEICProcessingResult {
  success: boolean;
  path: 'jpeg_passthrough' | 'webp_local' | 'webp_server' | 'failed';
  file?: File;
  processingTime?: number;
  reductionPercent?: number;
  quality?: number;
  error?: string;
  jobId?: string;
}

interface ProcessingStatus {
  phase: 'analyzing' | 'client_processing' | 'server_processing' | 'complete' | 'error';
  message: string;
  progress: number;
}

export const useHEICProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    phase: 'analyzing',
    message: '',
    progress: 0
  });
  const workerRef = useRef<Worker | null>(null);
  const { toast } = useToast();

  // Initialize Web Worker
  const initWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker('/heic-worker.js', { type: 'module' });
    }
    return workerRef.current;
  }, []);

  // Process HEIC file with fallback ladder
  const processHEICFile = useCallback(async (file: File): Promise<HEICProcessingResult> => {
    setIsProcessing(true);
    setProcessingStatus({
      phase: 'analyzing',
      message: 'Analyzing HEIC file...',
      progress: 10
    });

    try {
      // Step 1: Try client-side processing
      setProcessingStatus({
        phase: 'client_processing',
        message: 'Converting locally...',
        progress: 30
      });

      const clientResult = await tryClientProcessing(file);
      
      if (clientResult.success) {
        setProcessingStatus({
          phase: 'complete',
          message: `Converted to WebP (-${clientResult.reductionPercent}%)`,
          progress: 100
        });
        
        // Log telemetry
        console.log('HEIC Processing Telemetry:', {
          path: clientResult.path,
          processingTime: clientResult.processingTime,
          reductionPercent: clientResult.reductionPercent,
          quality: clientResult.quality
        });

        return clientResult;
      }

      // Step 2: Client failed, try server fallback
      console.log('Client processing failed, trying server fallback:', clientResult.error);
      
      setProcessingStatus({
        phase: 'server_processing',
        message: 'Processing on server...',
        progress: 60
      });

      const serverResult = await tryServerProcessing(file, clientResult.error);
      
      if (serverResult.success) {
        setProcessingStatus({
          phase: 'server_processing',
          message: 'Processing on server...',
          progress: 80
        });

        return {
          ...serverResult,
          path: 'webp_server'
        };
      }

      // Both failed
      throw new Error(`All processing methods failed. Client: ${clientResult.error}, Server: ${serverResult.error}`);

    } catch (error) {
      console.error('HEIC processing completely failed:', error);
      
      setProcessingStatus({
        phase: 'error',
        message: 'Processing failed',
        progress: 0
      });

      toast({
        title: "Processing Failed",
        description: "Unable to process HEIC file. Please try a different format.",
        variant: "destructive"
      });

      return {
        success: false,
        path: 'failed',
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Try client-side processing with Web Worker
  const tryClientProcessing = useCallback(async (file: File): Promise<HEICProcessingResult> => {
    return new Promise((resolve) => {
      const worker = initWorker();
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          path: 'failed',
          error: 'client_timeout'
        });
      }, 2000); // 2s timeout

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        resolve(e.data);
      };

      worker.onerror = () => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          path: 'failed',
          error: 'worker_error'
        });
      };

      // Send file to worker
      worker.postMessage({
        id: Math.random().toString(36),
        file: file
      });
    });
  }, [initWorker]);

  // Try server-side processing fallback
  const tryServerProcessing = useCallback(async (file: File, clientError?: string): Promise<HEICProcessingResult> => {
    try {
      // First, upload original file to trigger server processing
      const mediaId = crypto.randomUUID();
      const inputPath = `temp/heic/${mediaId}_${file.name}`;

      // Upload original HEIC file
      const { error: uploadError } = await supabase.storage
        .from('content')
        .upload(inputPath, file, {
          contentType: file.type || 'image/heic'
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Trigger server processing
      const { data, error } = await supabase.functions.invoke('heic-transcoder', {
        body: {
          mediaId,
          inputPath,
          originalFilename: file.name
        }
      });

      if (error) {
        throw new Error(`Server processing failed: ${error.message}`);
      }

      return {
        success: true,
        path: 'webp_server',
        jobId: data.jobId,
        processingTime: 0 // Server processing is async
      };

    } catch (error) {
      return {
        success: false,
        path: 'failed',
        error: error instanceof Error ? error.message : 'server_processing_failed'
      };
    }
  }, []);

  // Check processing job status
  const checkJobStatus = useCallback(async (jobId: string) => {
    const { data, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Failed to check job status:', error);
      return null;
    }

    return data;
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    processHEICFile,
    isProcessing,
    processingStatus,
    checkJobStatus,
    cleanup
  };
};