// HEIC Processing Web Worker
// Handles client-side HEIC conversion with strict limits and fallback

import 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

const MAX_PROCESSING_TIME = 1500; // 1.5s max
const MAX_MEMORY_ESTIMATE = 150 * 1024 * 1024; // 150MB
const MAX_DIMENSION = 4000; // Max long edge
const QUALITY_LADDER = [0.82, 0.76, 0.70];

class HEICProcessor {
  constructor() {
    this.startTime = 0;
    this.memoryEstimate = 0;
  }

  async processFile(file, options = {}) {
    this.startTime = performance.now();
    
    try {
      // Early content sniffing - check if HEIF container holds JPEG
      const buffer = await file.arrayBuffer();
      if (this.isJpegInHeicContainer(buffer)) {
        return {
          success: true,
          path: 'jpeg_passthrough',
          file: new File([buffer], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg'
          }),
          processingTime: performance.now() - this.startTime,
          reductionPercent: 0
        };
      }

      // Get image dimensions for memory estimation
      const dimensions = await this.getImageDimensions(buffer);
      this.memoryEstimate = dimensions.width * dimensions.height * 4; // RGBA
      
      if (this.memoryEstimate > MAX_MEMORY_ESTIMATE) {
        throw new Error('client_budget_exceeded');
      }

      // Dimension capping - downscale if needed
      let targetWidth = dimensions.width;
      let targetHeight = dimensions.height;
      const longEdge = Math.max(dimensions.width, dimensions.height);
      
      if (longEdge > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / longEdge;
        targetWidth = Math.round(dimensions.width * scale);
        targetHeight = Math.round(dimensions.height * scale);
      }

      // Try quality ladder
      for (const quality of QUALITY_LADDER) {
        if (performance.now() - this.startTime > MAX_PROCESSING_TIME) {
          throw new Error('processing_timeout');
        }

        try {
          const converted = await this.convertWithQuality(buffer, quality, targetWidth, targetHeight);
          const reductionPercent = Math.round((1 - converted.size / file.size) * 100);
          
          // Success if we got 40%+ reduction or it's under processing time limit
          if (reductionPercent >= 40 || (performance.now() - this.startTime) < 800) {
            return {
              success: true,
              path: 'webp_local',
              file: converted,
              processingTime: performance.now() - this.startTime,
              reductionPercent,
              quality
            };
          }
        } catch (err) {
          // Try next quality level
          continue;
        }
      }

      throw new Error('all_quality_levels_failed');
      
    } catch (error) {
      return {
        success: false,
        error: this.categorizeError(error),
        processingTime: performance.now() - this.startTime
      };
    }
  }

  async convertWithQuality(buffer, quality, width, height) {
    // Check timeout before each operation
    if (performance.now() - this.startTime > MAX_PROCESSING_TIME) {
      throw new Error('processing_timeout');
    }

    const converted = await heic2any({
      blob: new Blob([buffer]),
      toType: 'image/webp',
      quality: quality
    });

    // If we need to resize, do it here
    if (width && height) {
      return await this.resizeImage(converted, width, height, quality);
    }

    return converted instanceof Array ? converted[0] : converted;
  }

  async resizeImage(blob, width, height, quality) {
    return new Promise((resolve, reject) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.convertToBlob({ type: 'image/webp', quality }).then(resolve).catch(reject);
        } catch (err) {
          reject(new Error('canvas_limit'));
        }
      };
      
      img.onerror = () => reject(new Error('decode_failure'));
      img.src = URL.createObjectURL(blob);
    });
  }

  async getImageDimensions(buffer) {
    // Simple dimension extraction - fallback to reasonable defaults
    try {
      const blob = new Blob([buffer]);
      const img = new Image();
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
          // Fallback dimensions
          resolve({ width: 2000, height: 2000 });
        };
        img.src = URL.createObjectURL(blob);
      });
    } catch {
      return { width: 2000, height: 2000 };
    }
  }

  isJpegInHeicContainer(buffer) {
    // Check for JPEG magic number within HEIF container
    const view = new Uint8Array(buffer.slice(0, 1024));
    for (let i = 0; i < view.length - 2; i++) {
      if (view[i] === 0xFF && view[i + 1] === 0xD8) {
        return true; // JPEG SOI marker found
      }
    }
    return false;
  }

  categorizeError(error) {
    const message = error.message || error.toString();
    
    if (message.includes('timeout') || message.includes('processing_timeout')) {
      return 'processing_timeout';
    }
    if (message.includes('canvas') || message.includes('canvas_limit')) {
      return 'canvas_limit';
    }
    if (message.includes('decode') || message.includes('decode_failure')) {
      return 'decode_failure';
    }
    if (message.includes('budget') || message.includes('client_budget_exceeded')) {
      return 'client_budget_exceeded';
    }
    if (message.includes('memory') || message.includes('oom')) {
      return 'wasm_oom';
    }
    if (message.includes('corrupt')) {
      return 'container_corrupt';
    }
    if (message.includes('unsupported')) {
      return 'decode_unsupported';
    }
    
    return 'unknown_processing_error';
  }
}

// Worker message handler
self.onmessage = async function(e) {
  const { id, file, options } = e.data;
  
  const processor = new HEICProcessor();
  const result = await processor.processFile(file, options);
  
  self.postMessage({
    id,
    ...result
  });
};