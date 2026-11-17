import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../services/firebase';

export type MediaUploadKind = 'avatar' | 'vault_photo' | 'vault_document';
export type CloudMediaCategory = 'vault' | 'tree_avatars' | 'profile_avatars';

export interface ProcessedMediaResult {
  mainDataUrl: string;
  thumbnailDataUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  estimatedBytes: number;
  isPdfDocument: boolean;
}

export interface CloudMediaUploadResult {
  url: string;
  thumbnailUrl?: string;
  storagePath?: string;
  provider: 'firebase_storage' | 'firestore_chunked';
}

let cachedWebPSupport: boolean | null = null;

/**
 * Checks whether the current browser Canvas implementation supports encoding WebP.
 */
export function supportsCanvasWebP(): boolean {
  if (cachedWebPSupport !== null) return cachedWebPSupport;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const dataUrl = canvas.toDataURL('image/webp', 0.8);
    cachedWebPSupport = dataUrl.startsWith('data:image/webp');
    return cachedWebPSupport;
  } catch {
    cachedWebPSupport = false;
    return false;
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Length = dataUrl.length - commaIdx - 1;
  return Math.ceil((base64Length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المختار'));
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  });
}

function renderScaledCanvasDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: string,
  quality: number
): { dataUrl: string; width: number; height: number } {
  let width = img.naturalWidth || img.width || 800;
  let height = img.naturalHeight || img.height || 800;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Fill warm off-white background for transparent PNG scans before JPEG/WebP encoding
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let encoded = canvas.toDataURL(mimeType, quality);
  if (mimeType === 'image/webp' && !encoded.startsWith('data:image/webp')) {
    encoded = canvas.toDataURL('image/jpeg', quality);
  }
  return { dataUrl: encoded, width, height };
}

/**
 * Smart browser-side media compression pipeline:
 * - Preserves crisp legibility on historical Arabic documents/manuscripts (up to 1650px, 0.86 quality).
 * - Optimizes family photos (1280px, 0.82 quality) and avatars (512px, 0.82 quality) in WebP or JPEG.
 * - Generates a lightweight thumbnail (~320px) for instant Vault & Tree card rendering.
 */
export async function processMediaFileForUpload(
  file: File,
  kind: MediaUploadKind
): Promise<ProcessedMediaResult> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (isPdf || !file.type.startsWith('image/')) {
    return {
      mainDataUrl: rawDataUrl,
      thumbnailDataUrl: undefined,
      mimeType: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
      estimatedBytes: estimateDataUrlBytes(rawDataUrl),
      isPdfDocument: isPdf,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => {
      resolve({
        mainDataUrl: rawDataUrl,
        thumbnailDataUrl: rawDataUrl,
        mimeType: file.type || 'image/jpeg',
        estimatedBytes: estimateDataUrlBytes(rawDataUrl),
        isPdfDocument: false,
      });
    };

    img.onload = () => {
      try {
        const targetMime = supportsCanvasWebP() ? 'image/webp' : 'image/jpeg';
        const profile =
          kind === 'avatar'
            ? { maxDim: 512, quality: 0.82 }
            : kind === 'vault_document'
            ? { maxDim: 1650, quality: 0.86 }
            : { maxDim: 1280, quality: 0.82 };

        let mainPass = renderScaledCanvasDataUrl(
          img,
          profile.maxDim,
          targetMime,
          profile.quality
        );

        // Ensure fallback Firestore chunk safety (< ~680KB base64 string) even for dense scans
        if (mainPass.dataUrl.length > 700000) {
          mainPass = renderScaledCanvasDataUrl(
            img,
            Math.min(profile.maxDim, 1350),
            targetMime,
            0.76
          );
        }

        const thumbPass = renderScaledCanvasDataUrl(
          img,
          320,
          targetMime,
          0.72
        );

        const actualMime = mainPass.dataUrl.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg';

        resolve({
          mainDataUrl: mainPass.dataUrl,
          thumbnailDataUrl: thumbPass.dataUrl,
          mimeType: actualMime,
          width: mainPass.width,
          height: mainPass.height,
          estimatedBytes: estimateDataUrlBytes(mainPass.dataUrl),
          isPdfDocument: false,
        });
      } catch {
        resolve({
          mainDataUrl: rawDataUrl,
          thumbnailDataUrl: rawDataUrl,
          mimeType: file.type || 'image/jpeg',
          estimatedBytes: estimateDataUrlBytes(rawDataUrl),
          isPdfDocument: false,
        });
      }
    };

    img.src = rawDataUrl;
  });
}

function withFastTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('STORAGE_UPLOAD_TIMEOUT'));
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Uploads compressed media to isolated customer paths in Firebase Storage:
 * - `users/{uid}/vault/{itemId}`
 * - `users/{uid}/tree_avatars/{personId}`
 * - `users/{uid}/profile_avatars/{avatarId}`
 *
 * Seamlessly falls back (`provider: 'firestore_chunked'`) to the compressed DataURL
 * if Firebase Storage is disabled, unconfigured, or blocked by network/CORS —
 * guaranteeing zero failed uploads under any circumstance.
 */
export async function uploadMediaToCloudWithFallback(params: {
  uid?: string;
  category: CloudMediaCategory;
  itemId: string;
  mainDataUrl: string;
  thumbnailDataUrl?: string;
  mimeType?: string;
}): Promise<CloudMediaUploadResult> {
  const safeUid = (params.uid || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeItemId = (params.itemId || `media_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 90);

  if (!safeUid || !params.mainDataUrl.startsWith('data:')) {
    return {
      url: params.mainDataUrl,
      thumbnailUrl: params.thumbnailDataUrl,
      provider: 'firestore_chunked',
    };
  }

  const ext =
    params.mimeType === 'image/webp'
      ? 'webp'
      : params.mimeType === 'application/pdf'
      ? 'pdf'
      : 'jpg';
  const storagePath = `users/${safeUid}/${params.category}/${safeItemId}.${ext}`;

  try {
    const mainRef = ref(storage, storagePath);
    const uploadTask = (async () => {
      await uploadString(mainRef, params.mainDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(mainRef);

      let uploadedThumbUrl = params.thumbnailDataUrl;
      if (
        params.thumbnailDataUrl &&
        params.thumbnailDataUrl.startsWith('data:') &&
        params.category === 'vault'
      ) {
        try {
          const thumbRef = ref(
            storage,
            `users/${safeUid}/${params.category}/${safeItemId}_thumb.${ext === 'pdf' ? 'jpg' : ext}`
          );
          await uploadString(thumbRef, params.thumbnailDataUrl, 'data_url');
          uploadedThumbUrl = await getDownloadURL(thumbRef);
        } catch {
          // Keep compact inline thumbnail DataURL (~10-20KB) for instant card rendering
        }
      }

      return {
        url: downloadUrl,
        thumbnailUrl: uploadedThumbUrl,
        storagePath,
        provider: 'firebase_storage' as const,
      };
    })();

    return await withFastTimeout(uploadTask, 4200);
  } catch {
    // Seamless Fallback: caller persists via chunked Firestore documents with zero failure
    return {
      url: params.mainDataUrl,
      thumbnailUrl: params.thumbnailDataUrl,
      storagePath,
      provider: 'firestore_chunked',
    };
  }
}
