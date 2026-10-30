export const PROFILE_PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const PROFILE_PHOTO_UPLOAD_MAX_BYTES = 250 * 1024;

export async function prepareProfilePhoto(
  file: File,
  zoom: number,
  offsetX: number,
  offsetY: number,
  viewportSize: number,
): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > PROFILE_PHOTO_SOURCE_MAX_BYTES) {
    throw new Error('Choose an image smaller than 20 MB.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode().catch(() => { throw new Error('This photo could not be opened. Try a JPEG, PNG or WebP image.'); });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 48_000_000) {
      throw new Error('This photo is too large. Choose a smaller image.');
    }

    for (const edge of [640, 512, 384]) {
      const canvas = document.createElement('canvas');
      canvas.width = edge;
      canvas.height = edge;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo preparation failed. Please try again.');
      const scale = Math.max(edge / image.naturalWidth, edge / image.naturalHeight) * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const x = (edge - width) / 2 + (offsetX / viewportSize) * edge;
      const y = (edge - height) / 2 + (offsetY / viewportSize) * edge;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, edge, edge);
      context.drawImage(image, x, y, width, height);
      for (const quality of [0.88, 0.78, 0.68, 0.58]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= PROFILE_PHOTO_UPLOAD_MAX_BYTES) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Photo preparation failed. Please try again.'));
            reader.readAsDataURL(blob);
          });
        }
      }
    }
    throw new Error('This photo could not be prepared. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
