import { ApiError, API_PREFIX, NETWORK_ERROR_MESSAGE } from "./api-client";
import { getApiBaseUrl } from "./api-config";
import {
  mediaUploadProvider,
  uploadCloudMedia,
} from "./cloud-media-upload.service";

export interface MediaUploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** XMLHttpRequest exposes actual upload progress; the browser sets the multipart boundary. */
export async function uploadMedia<T>(
  path: string,
  token: string,
  field: string,
  file: File,
  input: object,
  options: MediaUploadOptions = {},
  sizeError = "This file is too large.",
): Promise<T> {
  if (options.signal?.aborted) throw new ApiError(0, "Upload canceled.");
  const provider = await mediaUploadProvider(token);
  if (options.signal?.aborted) throw new ApiError(0, "Upload canceled.");
  if (provider === "blob")
    return uploadCloudMedia<T>(path, token, file, input, options);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = () => options.signal?.removeEventListener("abort", abort);
    if (options.signal?.aborted) {
      reject(new ApiError(0, "Upload canceled."));
      return;
    }
    const body = new FormData();
    body.append(field, file);
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined)
        body.append(
          key,
          Array.isArray(value) ? JSON.stringify(value) : String(value),
        );
    }
    request.open("POST", `${getApiBaseUrl()}${API_PREFIX}${path}`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("Accept", "application/json");
    request.timeout = 10 * 60 * 1000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      finish();
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(
          new ApiError(
            request.status || 502,
            "Upload failed. Please try again.",
          ),
        );
        return;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T);
      } else {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload
            ? (payload as { message: unknown }).message
            : null;
        reject(
          new ApiError(
            request.status,
            request.status === 413
              ? sizeError
              : typeof message === "string"
                ? message
                : Array.isArray(message)
                  ? message.join(" ")
                  : "Upload failed. Please try again.",
          ),
        );
      }
    };
    request.onerror = request.ontimeout = () => {
      finish();
      reject(new ApiError(0, NETWORK_ERROR_MESSAGE));
    };
    request.onabort = () => {
      finish();
      reject(new ApiError(0, "Upload canceled."));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    request.send(body);
  });
}
