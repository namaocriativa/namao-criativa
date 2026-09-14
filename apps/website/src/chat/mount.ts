import { mountNamaoChat } from './widget';
import { hydrateAuth } from './api';

export { clearChatSession } from './api';

export function mountWebsiteChat() {
  if (typeof window === 'undefined') return;
  void hydrateAuth().then((loggedIn) => {
    mountNamaoChat(loggedIn);
  });
}
