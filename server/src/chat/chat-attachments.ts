import { BadRequestException } from '@nestjs/common';
import { decodePhotoPayload } from '../common/media/photo-payload';

/** Photo and recorded audio only; bytes persist in PostgreSQL on Vercel. */
export function decodeChatAttachment(dataUrl: string) {
  if (dataUrl.startsWith('data:image/')) {
    const photo = decodePhotoPayload(dataUrl);
    return {
      attachmentData: photo.photoData,
      attachmentType: photo.contentType,
      messageType: 'IMAGE' as const,
      content: 'Photo',
    };
  }
  const invalid = () =>
    new BadRequestException('Choose a supported voice message up to 1 MB.');
  const match =
    /^data:(audio\/(?:webm|ogg|mp4|mpeg|wav))(?:;codecs=[a-z0-9.,-]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      dataUrl,
    );
  if (!match) throw invalid();
  const mime = match[1].toLowerCase();
  const data = Buffer.from(match[2], 'base64');
  if (
    !data.length ||
    data.length > 1024 * 1024 ||
    data.toString('base64') !== match[2]
  )
    throw invalid();
  const valid =
    mime === 'audio/webm'
      ? data.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))
      : mime === 'audio/ogg'
        ? data.toString('ascii', 0, 4) === 'OggS'
        : mime === 'audio/mp4'
          ? data.toString('ascii', 4, 8) === 'ftyp'
          : mime === 'audio/wav'
            ? data.toString('ascii', 0, 4) === 'RIFF' &&
              data.toString('ascii', 8, 12) === 'WAVE'
            : data.toString('ascii', 0, 3) === 'ID3' ||
              (data[0] === 255 && (data[1] & 224) === 224);
  if (!valid) throw invalid();
  return {
    attachmentData: new Uint8Array(data),
    attachmentType: mime,
    messageType: 'FILE' as const,
    content: 'Voice message',
  };
}
