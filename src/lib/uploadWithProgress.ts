import { supabase } from '@/integrations/supabase/client';

export interface UploadProgressEvent {
  bytesUploaded: number;
  totalBytes: number;
  progress: number;
  uploadSpeed: number; // bytes per second
  eta: number; // seconds remaining
}

export interface UploadWithProgressResult {
  data?: { path: string };
  error?: { message: string };
}

export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (event: UploadProgressEvent) => void,
  abortController: AbortController
): Promise<UploadWithProgressResult> {
  return new Promise(async (resolve) => {
    try {
      const startTime = Date.now();
      let lastProgressTime = startTime;
      let lastUploadedBytes = 0;

      // Handle abort
      const onAbort = () => {
        resolve({ error: { message: 'Upload cancelled' } });
      };
      abortController.signal.addEventListener('abort', onAbort);

      // Simulate progress tracking since Supabase SDK doesn't provide native progress events
      const simulateProgress = () => {
        const fileSize = file.size;
        let uploadedBytes = 0;
        const chunkSize = Math.max(fileSize * 0.01, 8192); // 1% of file size or 8KB minimum
        
        const progressInterval = setInterval(() => {
          if (abortController.signal.aborted) {
            clearInterval(progressInterval);
            return;
          }

          uploadedBytes = Math.min(uploadedBytes + chunkSize, fileSize * 0.95); // Cap at 95% until actual completion
          const now = Date.now();
          const timeElapsed = (now - lastProgressTime) / 1000;
          const bytesThisInterval = uploadedBytes - lastUploadedBytes;
          
          // Calculate upload speed
          const currentSpeed = timeElapsed > 0 ? bytesThisInterval / timeElapsed : 0;
          const totalTimeElapsed = (now - startTime) / 1000;
          const averageSpeed = totalTimeElapsed > 0 ? uploadedBytes / totalTimeElapsed : 0;
          
          const uploadSpeed = totalTimeElapsed < 5 ? averageSpeed : (currentSpeed * 0.3 + averageSpeed * 0.7);
          
          // Calculate ETA
          const remainingBytes = fileSize - uploadedBytes;
          const eta = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;
          
          onProgress({
            bytesUploaded: uploadedBytes,
            totalBytes: fileSize,
            progress: (uploadedBytes / fileSize) * 100,
            uploadSpeed: Math.max(0, uploadSpeed),
            eta: Math.max(0, eta)
          });

          lastProgressTime = now;
          lastUploadedBytes = uploadedBytes;

          // Stop simulation when we reach 95%
          if (uploadedBytes >= fileSize * 0.95) {
            clearInterval(progressInterval);
          }
        }, 100); // Update every 100ms

        return () => clearInterval(progressInterval);
      };

      // Start progress simulation
      const stopProgress = simulateProgress();

      try {
        // Use Supabase SDK for actual upload (avoids CORS issues)
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: true
          });

        // Stop progress simulation
        stopProgress();
        abortController.signal.removeEventListener('abort', onAbort);

        if (error) {
          resolve({ error: { message: error.message } });
        } else {
          // Complete progress to 100%
          onProgress({
            bytesUploaded: file.size,
            totalBytes: file.size,
            progress: 100,
            uploadSpeed: 0,
            eta: 0
          });

          resolve({ data: { path: data.path } });
        }
      } catch (uploadError) {
        stopProgress();
        abortController.signal.removeEventListener('abort', onAbort);
        resolve({ 
          error: { 
            message: uploadError instanceof Error ? uploadError.message : 'Upload failed' 
          } 
        });
      }

    } catch (error) {
      resolve({ 
        error: { 
          message: error instanceof Error ? error.message : 'Upload failed' 
        } 
      });
    }
  });
}