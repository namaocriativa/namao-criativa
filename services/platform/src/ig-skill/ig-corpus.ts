import type { IgMediaItem } from '../instagram/instagram-graph.client';

const STOP = new Set([
  'para',
  'como',
  'essa',
  'esse',
  'isto',
  'aqui',
  'mais',
  'muito',
  'sua',
  'seu',
  'com',
  'uma',
  'uns',
  'pelo',
  'pela',
  'dos',
  'das',
  'que',
  'nao',
  'não',
  'sim',
  'voce',
  'você',
  'pra',
  'the',
  'and',
  'http',
  'https',
]);

export type IgCorpus = {
  username: string | null;
  windowDays: number;
  postCount: number;
  mix: { image: number; video: number; carousel: number; other: number };
  postsPerWeek: number;
  gaps: string[];
  hashtags: Array<{ tag: string; count: number }>;
  ctas: { whatsapp: number; link: number; comment: number; save: number };
  captionChars: { avg: number; empty: number };
  themes: Array<{ tag: string; count: number }>;
  posts: Array<{
    id: string;
    mediaType: string;
    timestamp?: string;
    captionPreview: string;
    permalink?: string;
  }>;
};

export function compactIgCorpus(
  media: IgMediaItem[],
  opts: { username?: string | null; windowDays: number },
): IgCorpus {
  const mix = { image: 0, video: 0, carousel: 0, other: 0 };
  const hashtagCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();
  const ctas = { whatsapp: 0, link: 0, comment: 0, save: 0 };
  let captionTotal = 0;
  let empty = 0;
  const dated: number[] = [];
  const weekBuckets = new Map<string, number>();

  const posts = media.map((item) => {
    const type = item.mediaType.toUpperCase();
    if (type === 'IMAGE') mix.image += 1;
    else if (type === 'VIDEO' || type === 'REELS') mix.video += 1;
    else if (type === 'CAROUSEL_ALBUM') mix.carousel += 1;
    else mix.other += 1;

    const caption = (item.caption || '').trim();
    if (!caption) empty += 1;
    captionTotal += caption.length;
    countHashtags(caption, hashtagCounts);
    countThemes(caption, themeCounts);
    if (/whatsapp|wa\.me|api\.whatsapp/i.test(caption)) ctas.whatsapp += 1;
    if (/https?:\/\//i.test(caption)) ctas.link += 1;
    if (/coment/i.test(caption)) ctas.comment += 1;
    if (/salv/i.test(caption)) ctas.save += 1;

    const at = item.timestamp ? Date.parse(item.timestamp) : Number.NaN;
    if (!Number.isNaN(at)) {
      dated.push(at);
      const week = isoWeek(new Date(at));
      weekBuckets.set(week, (weekBuckets.get(week) || 0) + 1);
    }

    return {
      id: item.id,
      mediaType: item.mediaType,
      timestamp: item.timestamp,
      captionPreview: caption.slice(0, 220),
      permalink: item.permalink,
    };
  });

  const spanMs =
    dated.length > 1 ? Math.max(...dated) - Math.min(...dated) : 0;
  const weeks = Math.max(1, spanMs / (7 * 24 * 60 * 60 * 1000));
  const gaps = [...weekBuckets.entries()]
    .filter(([, count]) => count === 0)
    .map(([week]) => week);
  const missing = listMissingWeeks(dated, opts.windowDays);

  return {
    username: opts.username || null,
    windowDays: opts.windowDays,
    postCount: media.length,
    mix,
    postsPerWeek: Number((media.length / weeks).toFixed(2)),
    gaps: missing.length ? missing : gaps,
    hashtags: topCounts(hashtagCounts, 12),
    ctas,
    captionChars: {
      avg: media.length ? Math.round(captionTotal / media.length) : 0,
      empty,
    },
    themes: topCounts(themeCounts, 12),
    posts,
  };
}

function countHashtags(caption: string, into: Map<string, number>) {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
  for (const raw of matches) {
    const tag = raw.toLowerCase();
    into.set(tag, (into.get(tag) || 0) + 1);
  }
}

function countThemes(caption: string, into: Map<string, number>) {
  const cleaned = caption
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  for (const word of cleaned.split(/[^a-z0-9]+/)) {
    if (word.length < 4 || STOP.has(word) || /^\d+$/.test(word)) continue;
    into.set(word, (into.get(word) || 0) + 1);
  }
}

function topCounts(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

function isoWeek(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function listMissingWeeks(timestamps: number[], windowDays: number): string[] {
  if (!timestamps.length) return [];
  const newest = Math.max(...timestamps);
  const oldest = Math.min(newest - windowDays * 24 * 60 * 60 * 1000, Math.min(...timestamps));
  const present = new Set(timestamps.map((at) => isoWeek(new Date(at))));
  const missing: string[] = [];
  for (let at = oldest; at <= newest; at += 7 * 24 * 60 * 60 * 1000) {
    const week = isoWeek(new Date(at));
    if (!present.has(week) && !missing.includes(week)) missing.push(week);
  }
  return missing.slice(0, 8);
}
