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
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        resolve({ error: { message: 'No auth session' } });
        return;
      }

      // Prepare the upload URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://alzyzfjzwvofmjccirjq.supabase.co";
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenl6Zmp6d3ZvZm1qY2NpcmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyODkxNjMsImV4cCI6MjA3MDg2NTE2M30.DlmPO0LWTM0T4bMXJheMXdtftCVJZ5V961CUW-fEXmk";
      
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastProgressTime = startTime;
      let lastUploadedBytes = 0;

      // Handle abort
      const onAbort = () => {
        xhr.abort();
        resolve({ error: { message: 'Upload cancelled' } });
      };
      abortController.signal.addEventListener('abort', onAbort);

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const timeElapsed = (now - lastProgressTime) / 1000; // seconds
          const bytesThisInterval = event.loaded - lastUploadedBytes;
          
          // Calculate upload speed (smoothed)
          const currentSpeed = timeElapsed > 0 ? bytesThisInterval / timeElapsed : 0;
          const totalTimeElapsed = (now - startTime) / 1000;
          const averageSpeed = totalTimeElapsed > 0 ? event.loaded / totalTimeElapsed : 0;
          
          // Use a blend of current and average speed for smoother display
          const uploadSpeed = totalTimeElapsed < 5 ? averageSpeed : (currentSpeed * 0.3 + averageSpeed * 0.7);
          
          // Calculate ETA
          const remainingBytes = event.total - event.loaded;
          const eta = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;
          
          onProgress({
            bytesUploaded: event.loaded,
            totalBytes: event.total,
            progress: (event.loaded / event.total) * 100,
            uploadSpeed: Math.max(0, uploadSpeed),
            eta: Math.max(0, eta)
          });

          lastProgressTime = now;
          lastUploadedBytes = event.loaded;
        }
      };

      xhr.onload = () => {
        abortController.signal.removeEventListener('abort', onAbort);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ data: { path } });
        } else {
          resolve({ error: { message: `Upload failed with status ${xhr.status}` } });
        }
      };

      xhr.onerror = () => {
        abortController.signal.removeEventListener('abort', onAbort);
        resolve({ error: { message: 'Upload failed due to network error' } });
      };

      xhr.ontimeout = () => {
        abortController.signal.removeEventListener('abort', onAbort);
        resolve({ error: { message: 'Upload timed out' } });
      };

      // Configure request
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('apikey', anonKey);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.timeout = 300000; // 5 minutes timeout

      // Prepare form data
      const formData = new FormData();
      formData.append('', file); // Supabase expects empty key for file content

      // Start upload
      xhr.send(formData);

    } catch (error) {
      resolve({ 
        error: { 
          message: error instanceof Error ? error.message : 'Upload failed' 
        } 
      });
    }
  });
}