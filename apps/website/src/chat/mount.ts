import { mountNamaoChat } from './widget';

export { clearChatSession } from './api';

export function mountWebsiteChat() {
  if (typeof window === 'undefined') return;
  mountNamaoChat();
}
