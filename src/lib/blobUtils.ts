/**
 * Utility functions for blob and data URL operations
 */

/**
 * Converts a Blob to a data URL
 */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
};

/**
 * Converts a File to a data URL
 */
export const fileToDataURL = (file: File): Promise<string> => {
  return blobToDataURL(file);
};

/**
 * Creates a safe data URL from a blob with error handling
 */
export const createSafeDataURL = async (blob: Blob): Promise<string | null> => {
  try {
    return await blobToDataURL(blob);
  } catch (error) {
    console.warn('Failed to create data URL:', error);
    return null;
  }
};