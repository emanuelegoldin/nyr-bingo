import sharp from 'sharp';
import { createHash } from 'crypto';
import { extname } from 'path';

/**
 * Converts an image buffer to WEBP format.
 * Supports JPEG, PNG, and other formats that sharp can process.
 * 
 * @param buffer - The image file buffer to convert
 * @param quality - Quality level (1-100, default 80)
 * @returns Promise<Buffer> - The converted WEBP image buffer
 * @throws Error if the image cannot be processed
 */
export async function convertToWebP(
  buffer: Uint8Array<ArrayBufferLike>,
  quality: number = 80
): Promise<Uint8Array<ArrayBufferLike>> {
  try {
    const webpBuffer = await sharp(buffer)
      .webp({ quality })
      .toBuffer();
    return new Uint8Array(webpBuffer);
  } catch (error) {
    throw new Error(
      `Failed to convert image to WEBP: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Converts a File object to WEBP format if it's an image, otherwise returns the original buffer.
 * If it fails to convert, it will return the original file buffer as a fallback.
 * If the image already is a WEBP, it will return the original buffer without conversion.
 * @param file The File object to convert
 * @returns 
 */
export async function tryConvertToWebP(file: File): Promise<{ buffer: Uint8Array<ArrayBufferLike>, type: string, cadKey: string }> {
    // If webp already or not an image, return original buffer
    if (file.type === 'image/webp' || !file.type.startsWith('image/')) {
      const originalBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
      return { buffer: originalBytes, type: file.type, cadKey: contentAddressedKey(originalBytes, extname(file.name)) };
    }
    try {
        const originalBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
        const webpBuffer = await convertToWebP(originalBytes, 80);
        return { buffer: webpBuffer, type: 'image/webp', cadKey: contentAddressedKey(originalBytes, '.webp') };
    } catch (error) {
        const originalBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
        return { buffer: originalBytes, type: file.type, cadKey: contentAddressedKey(originalBytes, extname(file.name)) };
    }
}

function contentAddressedKey(buffer: Uint8Array<ArrayBufferLike>, ext: string): string {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
  return `${hash}${ext}`;
}