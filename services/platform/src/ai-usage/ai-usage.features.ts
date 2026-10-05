export const AI_FEATURES = {
  igSkill: 'ig_skill',
  siteSkill: 'site_skill',
  contentPlan: 'content_plan',
  calendarIdeas: 'calendar_ideas',
  carousel: 'carousel',
  flyer: 'flyer',
  repurpose: 'repurpose',
  creativeAgent: 'creative_agent',
  imageGenerate: 'image_generate',
  videoGenerate: 'video_generate',
  characterPhoto: 'character_photo',
  characterVideo: 'character_video',
  movieShot: 'movie_shot',
  ugc: 'ugc',
  startEnd: 'start_end',
  videoLivre: 'video_livre',
  publicChat: 'public_chat',
  namaoChat: 'namao_chat',
  unattributed: 'unattributed',
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

const LEAD_HISTORY_FEATURES: Record<string, string> = {
  'skill.instagram': AI_FEATURES.igSkill,
  'skill.site': AI_FEATURES.siteSkill,
  'content-plan.confirmed': AI_FEATURES.contentPlan,
  'content_plan.confirmed': AI_FEATURES.contentPlan,
  'calendar.ideas': AI_FEATURES.calendarIdeas,
  'calendar.post': AI_FEATURES.carousel,
  'chat.session': AI_FEATURES.publicChat,
};

export function featureForHistoryKind(kind: string): string | null {
  return LEAD_HISTORY_FEATURES[kind] || null;
}

export const AI_USAGE_STATUS = {
  billed: 'billed',
  failedUnbilled: 'failed_unbilled',
  estimated: 'estimated',
} as const;

export const AI_USAGE_KIND = {
  text: 'text',
  image: 'image',
  video: 'video',
} as const;
