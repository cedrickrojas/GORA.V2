import { apiRequest, ApiError, NETWORK_ERROR_MESSAGE } from "./api-client";
import type { MediaUploadOptions } from "./media-upload.service";

export async function mediaUploadProvider(
  token: string,
): Promise<"local" | "blob"> {
  return (
    await apiRequest<{ provider: "local" | "blob" }>("/media/uploads/config", {
      token,
    })
  ).provider;
}

export async function uploadCloudMedia<T>(
  path: string,
  token: string,
  file: File,
  input: object,
  options: MediaUploadOptions,
): Promise<T> {
  const canceled = () => {
    if (options.signal?.aborted) throw new ApiError(0, "Upload canceled.");
  };
  canceled();
  const resource = path.startsWith("/stories/") ? "stories" : "reels";
  const ticket = await apiRequest<{
    uploadId: string;
    pathname: string;
    clientToken: string;
  }>("/media/uploads", {
    method: "POST",
    token,
    body: { resource, contentType: file.type, size: file.size },
  });
  try {
    canceled();
    const { put } = await import("@vercel/blob/client");
    await put(ticket.pathname, file, {
      access: "private",
      token: ticket.clientToken,
      contentType: file.type,
      multipart: file.size > 4 * 1024 * 1024,
      abortSignal: options.signal,
      onUploadProgress: (event) =>
        options.onProgress?.(Math.min(99, Math.round(event.percentage))),
    });
    canceled();
    // Only metadata crosses the Function; photos/videos go straight to private storage.
    const result = await apiRequest<T>(`${path}/complete`, {
      method: "POST",
      token,
      body: { ...input, uploadId: ticket.uploadId },
    });
    options.onProgress?.(100);
    return result;
  } catch (error) {
    await apiRequest(`/media/uploads/${ticket.uploadId}`, {
      method: "DELETE",
      token,
    }).catch(() => undefined);
    canceled();
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
}
