import { BadRequestException } from '@nestjs/common';

export const PHOTO_PAYLOAD_MAX_BYTES = 256 * 1024;

/** Only bounded raster payloads; arbitrary URLs, SVG and HTML are never accepted. */
export function decodePhotoPayload(dataUrl: string) {
  const invalid = () =>
    new BadRequestException('Choose a valid JPEG, PNG or WebP photo.');
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      dataUrl,
    );
  if (!match) throw invalid();
  const [, contentType, encoded] = match;
  const data = Buffer.from(encoded, 'base64');
  if (
    !data.length ||
    data.length > PHOTO_PAYLOAD_MAX_BYTES ||
    data.toString('base64') !== encoded
  )
    throw invalid();
  const valid =
    contentType === 'image/jpeg'
      ? data.length >= 4 &&
        data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) &&
        data.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
      : contentType === 'image/png'
        ? data.length >= 24 &&
          data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
        : data.length >= 16 &&
          data.toString('ascii', 0, 4) === 'RIFF' &&
          data.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw invalid();
  return { contentType, photoData: new Uint8Array(data) };
}
