/**
 * Integration point for media uploads. The uploads module will store the file in external
 * storage and return its public URL; only that URL is saved on the profile (never the
 * image itself). Until it exists, callers offer "Use an image URL" instead.
 */
export const IMAGE_UPLOADS_AVAILABLE = false;

export class UploadUnavailableError extends Error {
  constructor() {
    super('Photo uploads are coming soon. For now, paste a link to an image.');
    this.name = 'UploadUnavailableError';
  }
}

export async function uploadImage(file: File): Promise<string> {
  void file;
  throw new UploadUnavailableError();
}
