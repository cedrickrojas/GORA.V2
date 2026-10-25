import { HttpException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { PrivateMediaFile } from './private-media.storage';

export async function sendPrivateMedia(
  response: Response,
  file: PrivateMediaFile,
): Promise<void> {
  if ('send' in file) {
    await file.send(response);
    return;
  }
  await new Promise<void>((resolve, reject) =>
    response.sendFile(
      file.path,
      {
        headers: {
          'Content-Type': file.contentType,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      },
      (error: Error | undefined) => {
        if (!error) {
          resolve();
          return;
        }
        if (response.headersSent) {
          response.destroy(error);
          resolve();
          return;
        }
        if ('statusCode' in error && error.statusCode === 416)
          reject(new HttpException('Media range is not satisfiable.', 416));
        else if ('code' in error && error.code === 'ENOENT')
          reject(new NotFoundException('Media not found.'));
        else reject(error);
      },
    ),
  );
}
