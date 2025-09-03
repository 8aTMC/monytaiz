import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AudioConversionOptions {
  bitrate?: number; // in kbps
  quality?: 'high' | 'medium' | 'low';
}

interface AudioConversionResult {
  webmBlob: Blob;
  originalSize: number;
  convertedSize: number;
  compressionRatio: number;
}

export const useAudioConverter = () => {
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  const convertToWebM = async (
    file: File,
    options: AudioConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<AudioConversionResult | null> => {
    setIsConverting(true);
    
    try {
      const { quality = 'medium' } = options;
      
      // Quality-based settings
      const qualitySettings = {
        high: { bitrate: 128 },
        medium: { bitrate: 96 },
        low: { bitrate: 64 }
      };
      
      const settings = qualitySettings[quality];
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(
        Math.min(audioBuffer.numberOfChannels, 2), // Max 2 channels (stereo)
        audioBuffer.length,
        Math.min(audioBuffer.sampleRate, 48000) // Max 48kHz sample rate
      );
      
      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      
      onProgress?.(25);
      
      // Render audio
      const renderedBuffer = await offlineContext.startRendering();
      
      onProgress?.(50);
      
      // Convert to WebM using MediaRecorder
      const webmBlob = await new Promise<Blob>((resolve, reject) => {
        // Create a canvas to generate a dummy video stream for MediaRecorder
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const canvasStream = canvas.captureStream();
        
        // Create audio stream from rendered buffer
        const audioStream = new MediaStream();
        
        // Use MediaStreamAudioDestinationNode to create audio stream
        const tempContext = new AudioContext();
        const destination = tempContext.createMediaStreamDestination();
        const source = tempContext.createBufferSource();
        source.buffer = renderedBuffer;
        source.connect(destination);
        
        // Add audio track to our stream
        destination.stream.getAudioTracks().forEach(track => {
          audioStream.addTrack(track);
        });
        
        // Combine video and audio streams
        const combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ]);
        
        const chunks: Blob[] = [];
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/webm',
          audioBitsPerSecond: settings.bitrate * 1000
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const webmBlob = new Blob(chunks, { type: 'video/webm' });
          tempContext.close();
          resolve(webmBlob);
        };
        
        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          tempContext.close();
          reject(new Error('Audio conversion failed'));
        };
        
        // Start recording
        mediaRecorder.start();
        source.start(0);
        
        onProgress?.(75);
        
        // Stop recording after audio duration + small buffer
        setTimeout(() => {
          mediaRecorder.stop();
          source.stop();
        }, (renderedBuffer.duration + 0.1) * 1000);
      });
      
      onProgress?.(100);
      
      // Calculate compression stats
      const originalSize = file.size;
      const convertedSize = webmBlob.size;
      const compressionRatio = originalSize / convertedSize;
      
      console.log(`Audio converted: ${file.name} -> WebM (${compressionRatio.toFixed(2)}x compression)`);
      
      return {
        webmBlob,
        originalSize,
        convertedSize,
        compressionRatio
      };
      
    } catch (error) {
      console.error('Audio conversion failed:', error);
      toast({
        title: "Audio Conversion Failed",
        description: "Could not convert audio to WebM format. Using original file.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsConverting(false);
    }
  };

  // Simple fallback - just create a new blob with WebM mime type
  const fallbackConversion = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      // For unsupported browsers, just change the mime type
      // This won't actually convert but allows the file to be used
      const webmBlob = new Blob([file], { type: 'audio/webm' });
      resolve(webmBlob);
    });
  };

  const convertAudio = async (
    file: File,
    options: AudioConversionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<AudioConversionResult | null> => {
    // Check Web Audio API support
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      console.log('Web Audio API not supported - using fallback');
      try {
        const webmBlob = await fallbackConversion(file);
        return {
          webmBlob,
          originalSize: file.size,
          convertedSize: webmBlob.size,
          compressionRatio: 1
        };
      } catch (error) {
        return null;
      }
    }

    // Check MediaRecorder support for WebM
    if (!MediaRecorder.isTypeSupported('video/webm')) {
      console.log('WebM not supported by MediaRecorder - using fallback');
      try {
        const webmBlob = await fallbackConversion(file);
        return {
          webmBlob,
          originalSize: file.size,
          convertedSize: webmBlob.size,
          compressionRatio: 1
        };
      } catch (error) {
        return null;
      }
    }

    // Try full conversion
    return await convertToWebM(file, options, onProgress);
  };

  return {
    convertAudio,
    isConverting
  };
};