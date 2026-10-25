import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, head } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

/** Kept separate so storage/network failures can be tested without real cloud data. */
@Injectable()
export class BlobGateway {
  constructor(private readonly config: ConfigService) {}
  private get token(): string {
    return this.config.getOrThrow<string>('BLOB_READ_WRITE_TOKEN');
  }
  mint(pathname: string, contentType: string, size: number, expires: number) {
    return generateClientTokenFromReadWriteToken({
      token: this.token,
      pathname,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: size,
      validUntil: expires,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  }
  head(pathname: string) {
    return head(pathname, { token: this.token });
  }
  get(pathname: string, range?: string) {
    return get(pathname, {
      access: 'private',
      token: this.token,
      headers: range ? { Range: range } : undefined,
    });
  }
  remove(pathname: string) {
    return del(pathname, { token: this.token });
  }
}
