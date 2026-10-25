import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { uploadMedia } from "@/services/media-upload.service";
import { put } from "@vercel/blob/client";
vi.mock("@vercel/blob/client", () => ({ put: vi.fn() }));
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const ticket = {
  uploadId: "11111111-1111-4111-8111-111111111111",
  pathname: "gora/stories/photo.png",
  clientToken: "restricted-token",
};
beforeEach(() => {
  vi.mocked(put)
    .mockReset()
    .mockResolvedValue({
      url: "private",
      pathname: ticket.pathname,
      downloadUrl: "private",
      contentType: "image/png",
      contentDisposition: "inline",
    });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("sends media directly to private storage and only metadata through the API", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ provider: "blob" }))
    .mockResolvedValueOnce(json(ticket))
    .mockResolvedValueOnce(json({ id: "story" }));
  vi.stubGlobal("fetch", fetcher);
  const file = new File(["bytes"], "photo.png", { type: "image/png" }),
    progress = vi.fn();
  expect(
    await uploadMedia(
      "/stories/upload",
      "jwt",
      "media",
      file,
      { mediaType: "IMAGE", visibility: "ONLY_ME" },
      { onProgress: progress },
    ),
  ).toEqual({ id: "story" });
  expect(put).toHaveBeenCalledWith(
    ticket.pathname,
    file,
    expect.objectContaining({
      access: "private",
      token: ticket.clientToken,
      contentType: "image/png",
    }),
  );
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/media/uploads/config",
    "/api/v1/media/uploads",
    "/api/v1/stories/upload/complete",
  ]);
  const completed = JSON.parse(fetcher.mock.calls[2][1].body);
  expect(completed).toMatchObject({
    uploadId: ticket.uploadId,
    visibility: "ONLY_ME",
  });
  expect(completed.mediaUrl).toBeUndefined();
  expect(progress).toHaveBeenLastCalledWith(100);
});
test("cancellation removes the pending ticket and never completes a story", async () => {
  const controller = new AbortController();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ provider: "blob" }))
    .mockResolvedValueOnce(json(ticket))
    .mockResolvedValue(json({}));
  vi.stubGlobal("fetch", fetcher);
  vi.mocked(put).mockImplementationOnce(async () => {
    controller.abort();
    throw new Error("aborted");
  });
  await expect(
    uploadMedia(
      "/stories/upload",
      "jwt",
      "media",
      new File(["bytes"], "photo.png", { type: "image/png" }),
      { mediaType: "IMAGE", visibility: "PUBLIC" },
      { signal: controller.signal },
    ),
  ).rejects.toThrow("Upload canceled.");
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
    "/api/v1/media/uploads/" + ticket.uploadId,
  );
  expect(fetcher.mock.calls.at(-1)?.[1].method).toBe("DELETE");
  expect(fetcher.mock.calls.some((call) => call[0].endsWith("/complete"))).toBe(
    false,
  );
});
