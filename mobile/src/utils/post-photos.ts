export const POST_PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const POST_PHOTO_UPLOAD_MAX_BYTES = 256 * 1024;

/** Resize before uploading so even ten photos fit in one atomic post request. */
export async function preparePostPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > POST_PHOTO_SOURCE_MAX_BYTES) {
    throw new Error('Choose an image smaller than 20 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('This photo could not be opened. Try a JPEG, PNG or WebP image.');
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 48_000_000) {
      throw new Error('This photo is too large. Choose a smaller image.');
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preparation failed. Please try again.');
    let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 12; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (blob && blob.size <= POST_PHOTO_UPLOAD_MAX_BYTES) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Photo preparation failed. Please try again.'));
          reader.readAsDataURL(blob);
        });
      }
      scale *= 0.75;
    }
    throw new Error('This photo could not be prepared. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
