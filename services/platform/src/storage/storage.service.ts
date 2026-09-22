import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export const UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export function extensionForImage(
  mimeType: string | null,
  nameOrUrl: string,
): string {
  if (mimeType && MIME_EXTENSION[mimeType]) {
    return MIME_EXTENSION[mimeType];
  }
  const fromName = nameOrUrl.match(/\.(jpe?g|png|webp|gif|svg)(?:$|\?)/i);
  if (fromName) {
    return `.${fromName[1].toLowerCase().replace('jpeg', 'jpg')}`;
  }
  try {
    const pathname = new URL(nameOrUrl).pathname;
    const match = pathname.match(/\.(jpe?g|png|webp|gif|svg)$/i);
    if (match) {
      return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
    }
  } catch {
    // ignore invalid URL
  }
  return '.jpg';
}

export function extensionForVideo(
  mimeType: string | null,
  nameOrUrl: string,
): string {
  if (mimeType && MIME_EXTENSION[mimeType]) {
    return MIME_EXTENSION[mimeType];
  }
  const fromName = nameOrUrl.match(/\.(mp4|webm|mov)(?:$|\?)/i);
  if (fromName) return `.${fromName[1].toLowerCase()}`;
  return '.mp4';
}

export interface SavedImage {
  sourceUrl: string;
  localPath: string;
  filename: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

export interface SavedVideo {
  sourceUrl: string;
  localPath: string;
  filename: string;
  mimeType: string | null;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageRoot = path.join(__dirname, '..', '..', 'storage');
  private readonly leadsRoot = path.join(this.storageRoot, 'leads');
  private readonly packagesRoot = path.join(this.storageRoot, 'packages');
  private readonly imageProjectsRoot = path.join(
    this.storageRoot,
    'image-projects',
  );
  private readonly videoProjectsRoot = path.join(
    this.storageRoot,
    'video-projects',
  );
  private readonly charactersRoot = path.join(this.storageRoot, 'characters');
  private readonly moviesRoot = path.join(this.storageRoot, 'movies');
  private readonly startEndRoot = path.join(this.storageRoot, 'inicio-fim');
  private readonly ugcSkillsRoot = path.join(this.storageRoot, 'ugc-skills');
  private readonly calendarRoot = path.join(this.storageRoot, 'calendar');

  async ensureLeadImagesDir(leadId: string): Promise<string> {
    const dir = path.join(this.leadsRoot, leadId, 'images');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureLeadVideosDir(leadId: string): Promise<string> {
    const dir = path.join(this.leadsRoot, leadId, 'videos');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensurePackageImagesDir(packageId: string): Promise<string> {
    const dir = path.join(this.packagesRoot, packageId, 'images');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureImageProjectDir(projectId: string): Promise<string> {
    const dir = path.join(this.imageProjectsRoot, projectId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureVideoProjectDir(projectId: string): Promise<string> {
    const dir = path.join(this.videoProjectsRoot, projectId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureCharacterDir(characterId: string): Promise<string> {
    const dir = path.join(this.charactersRoot, characterId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureMovieDir(movieId: string): Promise<string> {
    const dir = path.join(this.moviesRoot, movieId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureStartEndDir(clipId: string): Promise<string> {
    const dir = path.join(this.startEndRoot, clipId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureUgcSkillsDir(clipId: string): Promise<string> {
    const dir = path.join(this.ugcSkillsRoot, clipId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async ensureCalendarDir(postId: string): Promise<string> {
    const dir = path.join(this.calendarRoot, postId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async downloadImage(
    leadId: string,
    sourceUrl: string,
    index: number,
  ): Promise<SavedImage | null> {
    try {
      const dir = await this.ensureLeadImagesDir(leadId);
      const response = await axios.get<ArrayBuffer>(sourceUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 8 * 1024 * 1024,
        headers: {
          'User-Agent':
            'discovery-lead-enrichment/1.0 (+https://localhost; lead-enrichment)',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType =
        (response.headers['content-type'] as string | undefined)?.split(
          ';',
        )[0] ?? null;
      const ext = extensionForImage(contentType, sourceUrl);
      const hash = createHash('md5').update(sourceUrl).digest('hex').slice(0, 8);
      const filename = `image-${String(index).padStart(2, '0')}-${hash}${ext}`;
      const absolutePath = path.join(dir, filename);
      await fs.writeFile(absolutePath, Buffer.from(response.data));

      const localPath = path
        .join('storage', 'leads', leadId, 'images', filename)
        .replace(/\\/g, '/');

      return {
        sourceUrl,
        localPath,
        filename,
        mimeType: contentType,
        width: null,
        height: null,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to download image ${sourceUrl}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async downloadVideo(
    leadId: string,
    sourceUrl: string,
    filename: string,
  ): Promise<SavedVideo | null> {
    try {
      const dir = await this.ensureLeadVideosDir(leadId);
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-') || 'hero.mp4';
      const response = await axios.get<ArrayBuffer>(sourceUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        maxContentLength: 40 * 1024 * 1024,
        headers: {
          'User-Agent':
            'discovery-lead-enrichment/1.0 (+https://localhost; landing-pipeline)',
        },
        validateStatus: (status) => status >= 200 && status < 400,
        maxRedirects: 5,
      });

      const contentType =
        (response.headers['content-type'] as string | undefined)?.split(
          ';',
        )[0] ?? null;
      const absolutePath = path.join(dir, safeName);
      await fs.writeFile(absolutePath, Buffer.from(response.data));

      const localPath = path
        .join('storage', 'leads', leadId, 'videos', safeName)
        .replace(/\\/g, '/');

      return {
        sourceUrl,
        localPath,
        filename: safeName,
        mimeType: contentType,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to download video ${sourceUrl}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async saveUploadedVideo(
    leadId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    slot: 'background' | 'portrait',
  ): Promise<SavedVideo> {
    const dir = await this.ensureLeadVideosDir(leadId);
    const ext = extensionForVideo(mimeType, originalName);
    const filename = `hero-${slot}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);
    const localPath = path
      .join('storage', 'leads', leadId, 'videos', filename)
      .replace(/\\/g, '/');
    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType,
    };
  }

  async listLeadVideos(leadId: string): Promise<SavedVideo[]> {
    const dir = path.join(this.leadsRoot, leadId, 'videos');
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const videos: SavedVideo[] = [];
    for (const filename of names) {
      if (filename.startsWith('.')) continue;
      const full = path.join(dir, filename);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
      videos.push({
        sourceUrl: `upload://${filename}`,
        localPath: path
          .join('storage', 'leads', leadId, 'videos', filename)
          .replace(/\\/g, '/'),
        filename,
        mimeType: filename.endsWith('.webm') ? 'video/webm' : 'video/mp4',
      });
    }
    return videos;
  }

  async saveUploadedImage(
    leadId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
  ): Promise<SavedImage> {
    const dir = await this.ensureLeadImagesDir(leadId);
    const ext = extensionForImage(mimeType, originalName);
    const filename = `upload-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'leads', leadId, 'images', filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${randomUUID()}`,
      localPath,
      filename,
      mimeType,
      width: null,
      height: null,
    };
  }

  async saveUploadedPackageImage(
    packageId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
  ): Promise<SavedImage> {
    const dir = await this.ensurePackageImagesDir(packageId);
    const ext = extensionForImage(mimeType, originalName);
    const filename = `upload-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'packages', packageId, 'images', filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${randomUUID()}`,
      localPath,
      filename,
      mimeType,
      width: null,
      height: null,
    };
  }

  async removeImageFile(localPath: string): Promise<void> {
    const absolute = this.resolveStorageFile(localPath);
    if (!absolute) return;
    try {
      await fs.unlink(absolute);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Failed to remove image ${localPath}: ${(error as Error).message}`,
        );
      }
    }
  }

  async removeLeadDir(leadId: string): Promise<void> {
    const dir = path.join(this.leadsRoot, leadId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for lead ${leadId}: ${(error as Error).message}`,
      );
    }
  }

  async removePackageDir(packageId: string): Promise<void> {
    const dir = path.join(this.packagesRoot, packageId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for package ${packageId}: ${(error as Error).message}`,
      );
    }
  }

  async saveImageProjectAsset(
    projectId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedImage> {
    const dir = await this.ensureImageProjectDir(projectId);
    const ext = extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'image-projects', projectId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType,
      width: null,
      height: null,
    };
  }

  async readStorageFile(localPath: string): Promise<Buffer | null> {
    const absolute = this.resolveStorageFile(localPath);
    if (!absolute) return null;
    try {
      return await fs.readFile(absolute);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Failed to read ${localPath}: ${(error as Error).message}`,
        );
      }
      return null;
    }
  }

  async saveVideoProjectAsset(
    projectId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedVideo> {
    const dir = await this.ensureVideoProjectDir(projectId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'video-projects', projectId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
    };
  }

  async removeImageProjectDir(projectId: string): Promise<void> {
    const dir = path.join(this.imageProjectsRoot, projectId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for image project ${projectId}: ${(error as Error).message}`,
      );
    }
  }

  async removeVideoProjectDir(projectId: string): Promise<void> {
    const dir = path.join(this.videoProjectsRoot, projectId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for video project ${projectId}: ${(error as Error).message}`,
      );
    }
  }

  async saveCharacterAsset(
    characterId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedImage> {
    const dir = await this.ensureCharacterDir(characterId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'characters', characterId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
      width: null,
      height: null,
    };
  }

  async removeCharacterDir(characterId: string): Promise<void> {
    const dir = path.join(this.charactersRoot, characterId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for character ${characterId}: ${(error as Error).message}`,
      );
    }
  }

  async saveMovieAsset(
    movieId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'shot',
  ): Promise<SavedImage> {
    const dir = await this.ensureMovieDir(movieId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'shot';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'movies', movieId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
      width: null,
      height: null,
    };
  }

  async removeMovieDir(movieId: string): Promise<void> {
    const dir = path.join(this.moviesRoot, movieId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for movie ${movieId}: ${(error as Error).message}`,
      );
    }
  }

  async saveStartEndAsset(
    clipId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedImage> {
    const dir = await this.ensureStartEndDir(clipId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'inicio-fim', clipId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
      width: null,
      height: null,
    };
  }

  async removeStartEndDir(clipId: string): Promise<void> {
    const dir = path.join(this.startEndRoot, clipId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for start-end clip ${clipId}: ${(error as Error).message}`,
      );
    }
  }

  async saveUgcSkillsAsset(
    clipId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedImage> {
    const dir = await this.ensureUgcSkillsDir(clipId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'ugc-skills', clipId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
      width: null,
      height: null,
    };
  }

  async removeUgcSkillsDir(clipId: string): Promise<void> {
    const dir = path.join(this.ugcSkillsRoot, clipId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for UGC clip ${clipId}: ${(error as Error).message}`,
      );
    }
  }

  async saveCalendarAsset(
    postId: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string | null,
    prefix = 'asset',
  ): Promise<SavedImage> {
    const dir = await this.ensureCalendarDir(postId);
    const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const ext = mime.startsWith('video/')
      ? extensionForVideo(mime, originalName)
      : extensionForImage(mimeType, originalName);
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
    const filename = `${safePrefix}-${randomUUID()}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const localPath = path
      .join('storage', 'calendar', postId, filename)
      .replace(/\\/g, '/');

    return {
      sourceUrl: `upload://${filename}`,
      localPath,
      filename,
      mimeType: mimeType || (ext === '.mp4' ? 'video/mp4' : null),
      width: null,
      height: null,
    };
  }

  async removeCalendarDir(postId: string): Promise<void> {
    const dir = path.join(this.calendarRoot, postId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Failed to remove storage for calendar post ${postId}: ${(error as Error).message}`,
      );
    }
  }

  private resolveStorageFile(localPath: string): string | null {
    const relative = localPath.replace(/^\/+/, '');
    const absolute = path.resolve(this.storageRoot, '..', relative);
    const root = path.resolve(this.storageRoot);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      this.logger.warn(`Refused to delete path outside storage: ${localPath}`);
      return null;
    }
    return absolute;
  }
}
