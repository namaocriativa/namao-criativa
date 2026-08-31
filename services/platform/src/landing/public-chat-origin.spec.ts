import { publicChatApiOrigin } from './public-chat-origin';

describe('publicChatApiOrigin', () => {
  const original = process.env.PUBLIC_CHAT_API_ORIGIN;
  const nodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_CHAT_API_ORIGIN;
    else process.env.PUBLIC_CHAT_API_ORIGIN = original;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  });

  it('usa o env quando definido', () => {
    process.env.PUBLIC_CHAT_API_ORIGIN = 'https://chat.example.com/';
    expect(publicChatApiOrigin()).toBe('https://chat.example.com');
  });

  it('em dev aponta para o client-api local', () => {
    delete process.env.PUBLIC_CHAT_API_ORIGIN;
    process.env.NODE_ENV = 'development';
    expect(publicChatApiOrigin()).toBe('http://localhost:3001');
  });
});
