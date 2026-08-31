import type { LeadBrief } from './pipeline.types';

export type PexelsVideoFile = {
  id?: number;
  quality?: string;
  file_type?: string;
  width?: number;
  height?: number;
  link?: string;
};

export type PexelsVideo = {
  id?: number;
  width?: number;
  height?: number;
  duration?: number;
  url?: string;
  image?: string;
  user?: { id?: number; name?: string; url?: string };
  video_files?: PexelsVideoFile[];
};

export type PexelsCandidate = {
  id: number;
  duration: number;
  width: number;
  height: number;
  user: string;
  photographerUrl: string;
  pageUrl: string;
  posterUrl: string;
  downloadUrl: string;
  downloadWidth: number;
  downloadHeight: number;
};

export type PexelsQueryChoice = {
  query: string;
  queryAlt: string;
  reason: string;
};

export type PexelsPickChoice = {
  videoId: number;
  reason: string;
};

const MIN_DURATION = 6;
const MAX_DURATION = 30;
const MIN_HD_WIDTH = 1280;
const MAX_HD_WIDTH = 1920;

export function heroStockVideoRequested(
  sections: Array<{ type: string; stockVideo?: boolean }>,
): boolean {
  return sections.some((section) => section.type === 'hero' && section.stockVideo);
}

export function cleanPexelsQuery(raw: unknown): string {
  const text = String(raw || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.split(' ').slice(0, 6).join(' ');
}

export function heuristicPexelsQuery(brief: LeadBrief): PexelsQueryChoice {
  const niche = String(brief.category || '').trim() || 'professional office';
  const service = String(brief.services?.[0] || '').trim();
  const query = cleanPexelsQuery(`${niche} interior`) || 'professional office interior';
  const queryAlt =
    cleanPexelsQuery(service ? `${service} workplace` : `${niche} desk`) ||
    'office desk documents';
  return {
    query,
    queryAlt,
    reason: 'fallback heurístico a partir da categoria/serviço',
  };
}

export function parsePexelsQuery(value: unknown): PexelsQueryChoice {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const query = cleanPexelsQuery(record.query);
  if (!query) {
    throw new Error('query Pexels vazia');
  }
  const queryAlt = cleanPexelsQuery(record.queryAlt) || query;
  const reason = String(record.reason || '').trim().slice(0, 240);
  return { query, queryAlt, reason };
}

export function pickDownloadFile(
  files: PexelsVideoFile[] | undefined,
): { link: string; width: number; height: number } | null {
  if (!files?.length) return null;
  const mp4 = files.filter((file) => {
    const type = String(file.file_type || '').toLowerCase();
    const link = String(file.link || '');
    const width = Number(file.width) || 0;
    const height = Number(file.height) || 0;
    if (!link || width < height) return false;
    if (type && !type.includes('mp4') && !link.includes('.mp4')) return false;
    return width >= MIN_HD_WIDTH && width <= MAX_HD_WIDTH;
  });
  if (!mp4.length) return null;
  mp4.sort(
    (a, b) =>
      Math.abs((Number(a.width) || 0) - MAX_HD_WIDTH) -
      Math.abs((Number(b.width) || 0) - MAX_HD_WIDTH),
  );
  const best = mp4[0];
  return {
    link: String(best.link),
    width: Number(best.width) || 0,
    height: Number(best.height) || 0,
  };
}

export function toPexelsCandidate(video: PexelsVideo): PexelsCandidate | null {
  const id = Number(video.id);
  const duration = Number(video.duration) || 0;
  const width = Number(video.width) || 0;
  const height = Number(video.height) || 0;
  if (!id || duration < MIN_DURATION || duration > MAX_DURATION) return null;
  if (width < height) return null;
  const file = pickDownloadFile(video.video_files);
  if (!file) return null;
  const posterUrl = String(video.image || '').trim();
  const pageUrl = String(video.url || '').trim();
  const user = String(video.user?.name || 'Pexels').trim() || 'Pexels';
  const photographerUrl = String(video.user?.url || '').trim();
  return {
    id,
    duration,
    width,
    height,
    user,
    photographerUrl,
    pageUrl,
    posterUrl,
    downloadUrl: file.link,
    downloadWidth: file.width,
    downloadHeight: file.height,
  };
}

export function filterPexelsCandidates(
  videos: PexelsVideo[] | undefined,
  limit = 6,
): PexelsCandidate[] {
  if (!videos?.length) return [];
  const picked: PexelsCandidate[] = [];
  const seen = new Set<number>();
  for (const video of videos) {
    const candidate = toPexelsCandidate(video);
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picked.push(candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function parsePexelsPick(
  value: unknown,
  allowedIds: number[],
): PexelsPickChoice {
  const allowed = new Set(allowedIds);
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const videoId = Number(record.videoId);
  if (!videoId || !allowed.has(videoId)) {
    throw new Error('videoId Pexels inválido');
  }
  const reason = String(record.reason || '').trim().slice(0, 240);
  return { videoId, reason };
}

export function fallbackPexelsPick(
  candidates: PexelsCandidate[],
  videoId?: number,
): PexelsCandidate | null {
  if (!candidates.length) return null;
  if (videoId) {
    const match = candidates.find((item) => item.id === videoId);
    if (match) return match;
  }
  return candidates[0];
}

export function pexelsCreditLine(candidate: PexelsCandidate): string {
  const name = candidate.user || 'Pexels';
  return `Video by ${name} on Pexels`;
}
