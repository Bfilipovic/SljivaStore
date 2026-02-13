/**
 * Image processing utilities for backend
 * Handles magic bytes verification and metadata stripping
 */

let sharpModule = null;
let sharpLoadAttempted = false;

/**
 * Lazy load sharp module
 * @returns {Promise<object|null>} - sharp module or null if not available
 */
async function loadSharp() {
  if (sharpLoadAttempted) {
    return sharpModule;
  }
  
  sharpLoadAttempted = true;
  try {
    sharpModule = (await import('sharp')).default;
  } catch (error) {
    console.warn('[imageProcessing] sharp not available, metadata stripping will be skipped:', error.message);
    sharpModule = null;
  }
  
  return sharpModule;
}

/**
 * Check if base64 image data is a valid JPEG by checking magic bytes
 * JPEG files start with: FF D8 FF
 * 
 * @param {string} base64Data - Base64 encoded image data (without data URL prefix)
 * @returns {boolean} - true if valid JPEG
 */
export function verifyJpegMagicBytes(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') {
    return false;
  }
  
  try {
    // Decode first few bytes of base64
    const buffer = Buffer.from(base64Data.substring(0, 12), 'base64');
    
    // JPEG magic bytes: FF D8 FF
    if (buffer.length >= 3) {
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Strip metadata from an image using sharp
 * This removes all EXIF, IPTC, and other metadata
 * 
 * @param {string} imageDataUrl - Base64 data URL of image (data:image/jpeg;base64,...)
 * @param {number} maxSizeMB - Maximum output size in MB (default: 10)
 * @returns {Promise<string>} - Base64 data URL of processed image (metadata stripped)
 */
export async function stripImageMetadata(imageDataUrl, maxSizeMB = 10) {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    throw new Error('Invalid image data');
  }
  
  // Extract base64 data
  const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid image data URL format');
  }
  
  const base64Data = base64Match[1];
  const imageBuffer = Buffer.from(base64Data, 'base64');
  
  // Verify it's a JPEG by magic bytes
  if (!verifyJpegMagicBytes(base64Data)) {
    throw new Error('File is not a valid JPEG image (magic bytes check failed)');
  }
  
  // Lazy load sharp
  const sharp = await loadSharp();
  
  // If sharp is not available, return original (metadata should already be stripped on frontend)
  if (!sharp) {
    console.warn('[stripImageMetadata] sharp not available, returning original image (should already be processed on frontend)');
    return imageDataUrl;
  }
  
  // Process image with sharp to strip metadata
  // sharp automatically strips all metadata when re-encoding
  let processedBuffer;
  let quality = 92; // Start with high quality
  const maxSize = maxSizeMB * 1024 * 1024;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      processedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: quality,
          mozjpeg: true, // Use mozjpeg for better compression
          progressive: false, // Disable progressive for smaller size
        })
        .toBuffer();
      
      if (processedBuffer.length <= maxSize || quality <= 50) {
        break;
      }
      
      // Reduce quality and try again
      quality -= 10;
      attempts++;
    } catch (error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
  
  // Final size check
  if (processedBuffer.length > maxSize) {
    throw new Error(`Image size exceeds ${maxSizeMB}MB limit after processing (${(processedBuffer.length / (1024 * 1024)).toFixed(2)}MB)`);
  }
  
  // Convert back to base64 data URL
  const processedBase64 = processedBuffer.toString('base64');
  return `data:image/jpeg;base64,${processedBase64}`;
}

/**
 * Process image: verify magic bytes and strip metadata
 * 
 * @param {string} imageDataUrl - Base64 data URL of image
 * @param {number} maxSizeMB - Maximum output size in MB (default: 10)
 * @returns {Promise<string>} - Base64 data URL of processed image
 */
export async function processImage(imageDataUrl, maxSizeMB = 10) {
  // Extract base64 data for magic bytes check
  const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid image data URL format');
  }
  
  const base64Data = base64Match[1];
  
  // Verify it's a JPEG by magic bytes
  if (!verifyJpegMagicBytes(base64Data)) {
    throw new Error('File is not a valid JPEG image (magic bytes check failed)');
  }
  
  // Strip metadata by re-encoding
  return await stripImageMetadata(imageDataUrl, maxSizeMB);
}

