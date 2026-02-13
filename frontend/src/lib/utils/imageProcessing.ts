/**
 * Image processing utilities for frontend
 * Handles magic bytes verification and metadata stripping
 */

/**
 * Check if a file is a valid JPEG by checking magic bytes
 * JPEG files start with: FF D8 FF
 * 
 * @param file - File object to check
 * @returns Promise<boolean> - true if valid JPEG
 */
export async function verifyJpegMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      
      // JPEG magic bytes: FF D8 FF
      if (bytes.length >= 3) {
        const isValid = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
        resolve(isValid);
      } else {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    // Only read first 3 bytes for magic bytes check
    reader.readAsArrayBuffer(file.slice(0, 3));
  });
}

/**
 * Strip metadata from an image by re-encoding it through canvas
 * This removes all EXIF, IPTC, and other metadata
 * 
 * @param file - Image file to process
 * @param maxSizeMB - Maximum output size in MB (default: 10)
 * @returns Promise<string> - Base64 data URL of processed image
 */
export async function stripImageMetadata(file: File, maxSizeMB: number = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw image to canvas (this strips metadata)
          ctx.drawImage(img, 0, 0);
          
          // Convert to JPEG with quality 0.92 (good balance of quality and size)
          // This will strip all metadata
          let quality = 0.92;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Check size and reduce quality if needed
          const maxSize = maxSizeMB * 1024 * 1024;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            const base64Data = dataUrl.split(',')[1] || '';
            const estimatedSize = (base64Data.length * 3) / 4;
            
            if (estimatedSize <= maxSize || quality <= 0.5) {
              break;
            }
            
            // Reduce quality and try again
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            attempts++;
          }
          
          // Final size check
          const finalBase64Data = dataUrl.split(',')[1] || '';
          const finalSize = (finalBase64Data.length * 3) / 4;
          
          if (finalSize > maxSize) {
            reject(new Error(`Image size exceeds ${maxSizeMB}MB limit after processing (${(finalSize / (1024 * 1024)).toFixed(2)}MB)`));
            return;
          }
          
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Process image: verify magic bytes and strip metadata
 * 
 * @param file - Image file to process
 * @param maxSizeMB - Maximum output size in MB (default: 10)
 * @returns Promise<string> - Base64 data URL of processed image
 */
export async function processImage(file: File, maxSizeMB: number = 10): Promise<string> {
  // First verify it's a JPEG by magic bytes
  const isValidJpeg = await verifyJpegMagicBytes(file);
  if (!isValidJpeg) {
    throw new Error('File is not a valid JPEG image (magic bytes check failed)');
  }
  
  // Strip metadata by re-encoding
  return await stripImageMetadata(file, maxSizeMB);
}

