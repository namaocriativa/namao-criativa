export function localApiOrigin(): string {
  const port = process.env.PLATFORM_PORT || process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

export function publicChatApiOrigin(): string {
  const configured = (process.env.PUBLIC_CHAT_API_ORIGIN || '').replace(
    /\/$/,
    '',
  );
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? '' : localApiOrigin();
}
