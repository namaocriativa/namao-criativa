export function publicChatApiOrigin(): string {
  const configured = (process.env.PUBLIC_CHAT_API_ORIGIN || '').replace(
    /\/$/,
    '',
  );
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
}
