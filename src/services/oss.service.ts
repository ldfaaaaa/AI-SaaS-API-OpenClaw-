import OSS from 'ali-oss';
import { randomUUID } from 'node:crypto';
import { BadRequestError, InternalServerError } from '../utils/errors';

export class OssService {
  private readonly client: OSS | null;
  private readonly publicBaseUrl: string;
  private warningPrinted = false;

  constructor() {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    const endpoint = process.env.OSS_ENDPOINT;

    this.publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL || '';

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      this.client = null;
      return;
    }

    this.client = new OSS({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      endpoint,
    });
  }

  async uploadFromUrl(sourceUrl: string, keyPrefix: string): Promise<string> {
    if (!sourceUrl) {
      throw new BadRequestError('上传OSS失败：sourceUrl不能为空');
    }

    if (!this.client) {
      if (!this.warningPrinted) {
        console.warn('OSS配置不完整，跳过上传并返回原始URL');
        this.warningPrinted = true;
      }
      return sourceUrl;
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new InternalServerError(`下载生成结果失败: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = this.resolveExtension(contentType, sourceUrl);
    const sanitizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, '');
    const objectKey = `${sanitizedPrefix}/${Date.now()}-${randomUUID()}${extension}`;

    const putResult = await this.client.put(objectKey, buffer, {
      headers: contentType
        ? {
            'Content-Type': contentType,
          }
        : undefined,
    });

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`;
    }

    return putResult.url;
  }

  private resolveExtension(contentType?: string, sourceUrl?: string): string {
    if (contentType?.includes('image/png')) return '.png';
    if (contentType?.includes('image/jpeg')) return '.jpg';
    if (contentType?.includes('image/webp')) return '.webp';
    if (contentType?.includes('video/mp4')) return '.mp4';

    if (sourceUrl) {
      const match = sourceUrl.match(/\.[a-zA-Z0-9]{2,5}(?:\?|$)/);
      if (match) {
        return match[0].split('?')[0];
      }
    }

    return '';
  }
}

export const ossService = new OssService();
