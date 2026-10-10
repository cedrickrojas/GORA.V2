import { afterEach, describe, expect, test, vi } from 'vitest';
import { preparePostPhoto, POST_PHOTO_UPLOAD_MAX_BYTES } from '@/utils/post-photos';
import { copyPostLink } from '@/utils/post-share';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('post photos', () => {
  test('rejects non-images and oversized source files', async () => {
    await expect(preparePostPhoto(new File(['text'], 'text.txt', { type: 'text/plain' }))).rejects.toThrow(
      'Choose an image',
    );
    await expect(
      preparePostPhoto(new File([new Uint8Array(21 * 1024 * 1024)], 'large.png', { type: 'image/png' })),
    ).rejects.toThrow('20 MB');
  });

  test('resizes repeatedly until the upload fits, and releases its preview URL', async () => {
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        naturalWidth = 3200;
        naturalHeight = 2400;
        decode = () => Promise.resolve();
      },
    );
    const createUrl = vi.fn(() => 'blob:photo');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: draw,
    } as unknown as CanvasRenderingContext2D);
    const sizes: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      sizes.push(this.width);
      callback(
        new Blob([new Uint8Array(sizes.length === 1 ? POST_PHOTO_UPLOAD_MAX_BYTES + 1 : 100)], { type: 'image/jpeg' }),
      );
    });
    expect(await preparePostPhoto(new File(['photo'], 'photo.png', { type: 'image/png' }))).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    expect(sizes).toEqual([1600, 1200]);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(revokeUrl).toHaveBeenCalledWith('blob:photo');
  });

  test('releases the preview when an image cannot decode', async () => {
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = () => Promise.reject(new Error('bad image'));
      },
    );
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:bad', revokeObjectURL: revokeUrl });
    await expect(preparePostPhoto(new File(['bad'], 'bad.png', { type: 'image/png' }))).rejects.toThrow(
      'could not be opened',
    );
    expect(revokeUrl).toHaveBeenCalledWith('blob:bad');
  });
});

describe('copy post link', () => {
  test('uses the clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyPostLink('https://gora.test/posts/123');
    expect(writeText).toHaveBeenCalledWith('https://gora.test/posts/123');
  });

  test('falls back to selection and removes its temporary input', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('blocked')) } });
    const copy = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: copy, configurable: true });
    await copyPostLink('https://gora.test/posts/123');
    expect(copy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
