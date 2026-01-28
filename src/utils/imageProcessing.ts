/**
 * Image Processing Utilities for Linen Scanner
 * Client-side preprocessing to enhance image quality before AI analysis
 */

export interface ImageQuality {
  brightness: number; // 0-100, 50 is ideal
  contrast: number; // 0-100, 50 is ideal
  sharpness: number; // 0-100, higher is better
  isBlurry: boolean;
  isTooLight: boolean;
  isTooDark: boolean;
  suggestions: string[];
}

/**
 * Analyze image quality and return metrics with suggestions
 */
export async function analyzeImageQuality(imageData: string): Promise<ImageQuality> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(getDefaultQuality());
        return;
      }
      
      // Use smaller size for analysis
      const maxSize = 200;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageDataRaw = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataRaw.data;
      
      // Calculate brightness
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminance formula
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        totalBrightness += brightness;
        pixelCount++;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      const normalizedBrightness = (avgBrightness / 255) * 100;
      
      // Calculate contrast (standard deviation of brightness)
      let varianceSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        varianceSum += Math.pow(brightness - avgBrightness, 2);
      }
      const stdDev = Math.sqrt(varianceSum / pixelCount);
      const normalizedContrast = Math.min(100, (stdDev / 128) * 100);
      
      // Estimate sharpness using Laplacian variance
      const sharpness = estimateSharpness(imageDataRaw);
      
      // Build quality assessment
      const isTooDark = normalizedBrightness < 30;
      const isTooLight = normalizedBrightness > 80;
      const isBlurry = sharpness < 20;
      
      const suggestions: string[] = [];
      if (isTooDark) suggestions.push('🔆 Ajoutez de la lumière');
      if (isTooLight) suggestions.push('🌑 Trop lumineux, réduisez la lumière');
      if (isBlurry) suggestions.push('✋ Stabilisez le téléphone');
      if (normalizedContrast < 20) suggestions.push('📷 Rapprochez-vous du linge');
      
      resolve({
        brightness: Math.round(normalizedBrightness),
        contrast: Math.round(normalizedContrast),
        sharpness: Math.round(sharpness),
        isBlurry,
        isTooLight,
        isTooDark,
        suggestions,
      });
    };
    
    img.onerror = () => resolve(getDefaultQuality());
    img.src = imageData;
  });
}

function getDefaultQuality(): ImageQuality {
  return {
    brightness: 50,
    contrast: 50,
    sharpness: 50,
    isBlurry: false,
    isTooLight: false,
    isTooDark: false,
    suggestions: [],
  };
}

/**
 * Estimate image sharpness using Laplacian variance
 */
function estimateSharpness(imageData: ImageData): number {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Convert to grayscale
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  
  // Apply Laplacian kernel
  let laplacianSum = 0;
  let count = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Laplacian: 4 * center - neighbors
      const laplacian = 
        4 * gray[idx] -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - width] -
        gray[idx + width];
      laplacianSum += laplacian * laplacian;
      count++;
    }
  }
  
  // Variance of Laplacian
  const variance = count > 0 ? laplacianSum / count : 0;
  // Normalize to 0-100 scale (typical values range 0-5000)
  return Math.min(100, (variance / 50));
}

/**
 * Enhance image for better AI recognition
 * - Auto-contrast adjustment
 * - Brightness normalization
 */
export async function enhanceImage(
  imageData: string, 
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      const imageDataRaw = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataRaw.data;
      
      // Find min/max for auto-contrast
      let minBrightness = 255;
      let maxBrightness = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        minBrightness = Math.min(minBrightness, brightness);
        maxBrightness = Math.max(maxBrightness, brightness);
      }
      
      // Apply contrast stretching if needed
      const range = maxBrightness - minBrightness;
      if (range > 50 && range < 200) {
        const factor = 255 / range;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, (data[i] - minBrightness) * factor));
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - minBrightness) * factor));
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - minBrightness) * factor));
        }
        ctx.putImageData(imageDataRaw, 0, 0);
      }
      
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.onerror = () => resolve(imageData);
    img.src = imageData;
  });
}

/**
 * Resize image for faster API transmission
 */
export function resizeImage(
  imageData: string,
  maxWidth: number = 1280,
  maxHeight: number = 960,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate scale
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      
      if (scale >= 1) {
        // No resize needed, just re-encode
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', quality));
        return;
      }
      
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Use high quality downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.onerror = () => resolve(imageData);
    img.src = imageData;
  });
}

/**
 * Capture frame from video element with preprocessing
 */
export async function captureAndProcessFrame(
  video: HTMLVideoElement,
  options: {
    quality?: number;
    maxWidth?: number;
    enhance?: boolean;
  } = {}
): Promise<{ imageData: string; quality: ImageQuality }> {
  const { quality = 0.7, maxWidth = 1280, enhance = false } = options;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx || video.videoWidth === 0) {
    throw new Error('Video not ready');
  }
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  
  let imageData = canvas.toDataURL('image/jpeg', quality);
  
  // Resize if needed
  if (video.videoWidth > maxWidth) {
    imageData = await resizeImage(imageData, maxWidth, undefined, quality);
  }
  
  // Analyze quality
  const imageQuality = await analyzeImageQuality(imageData);
  
  // Optionally enhance
  if (enhance && (imageQuality.brightness < 40 || imageQuality.contrast < 30)) {
    imageData = await enhanceImage(imageData, quality);
  }
  
  return { imageData, quality: imageQuality };
}
