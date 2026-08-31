import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  filterPexelsCandidates,
  type PexelsCandidate,
  type PexelsVideo,
} from './pexels-select';

type SearchResult = {
  candidates: PexelsCandidate[];
  rateLimit?: {
    limit?: string;
    remaining?: string;
    reset?: string;
  };
};

@Injectable()
export class PexelsService {
  private readonly logger = new Logger(PexelsService.name);

  apiKey(): string {
    return String(process.env.PEXELS_API_KEY || '').trim();
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey());
  }

  async searchVideos(query: string): Promise<SearchResult> {
    const key = this.apiKey();
    if (!key) return { candidates: [] };

    const url = new URL('https://api.pexels.com/v1/videos/search');
    url.searchParams.set('query', query);
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('size', 'medium');
    url.searchParams.set('locale', 'pt-BR');
    url.searchParams.set('per_page', '8');

    const response = await axios.get<{ videos?: PexelsVideo[] }>(url.toString(), {
      timeout: 15000,
      headers: {
        Authorization: key,
        'User-Agent':
          'discovery-lead-enrichment/1.0 (+https://localhost; landing-pipeline)',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return {
      candidates: filterPexelsCandidates(response.data?.videos),
      rateLimit: {
        limit: String(response.headers['x-ratelimit-limit'] || ''),
        remaining: String(response.headers['x-ratelimit-remaining'] || ''),
        reset: String(response.headers['x-ratelimit-reset'] || ''),
      },
    };
  }

  async downloadPoster(sourceUrl: string, destPath: string): Promise<boolean> {
    if (!sourceUrl) return false;
    try {
      const response = await axios.get<ArrayBuffer>(sourceUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 4 * 1024 * 1024,
        headers: {
          'User-Agent':
            'discovery-lead-enrichment/1.0 (+https://localhost; landing-pipeline)',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, Buffer.from(response.data));
      return true;
    } catch (error) {
      this.logger.warn(
        `Falha ao baixar poster Pexels: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
