import { publicChatApiOrigin } from './public-chat-origin';

describe('publicChatApiOrigin', () => {
  const original = process.env.PUBLIC_CHAT_API_ORIGIN;
  const nodeEnv = process.env.NODE_ENV;
  const port = process.env.PORT;
  const platformPort = process.env.PLATFORM_PORT;

  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_CHAT_API_ORIGIN;
    else process.env.PUBLIC_CHAT_API_ORIGIN = original;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (port === undefined) delete process.env.PORT;
    else process.env.PORT = port;
    if (platformPort === undefined) delete process.env.PLATFORM_PORT;
    else process.env.PLATFORM_PORT = platformPort;
  });

  it('usa o env quando definido', () => {
    process.env.PUBLIC_CHAT_API_ORIGIN = 'https://chat.example.com/';
    expect(publicChatApiOrigin()).toBe('https://chat.example.com');
  });

  it('em dev aponta para o client-api local', () => {
    delete process.env.PUBLIC_CHAT_API_ORIGIN;
    delete process.env.PLATFORM_PORT;
    delete process.env.PORT;
    process.env.NODE_ENV = 'development';
    expect(publicChatApiOrigin()).toBe('http://localhost:3000');
  });

  it('em dev usa PLATFORM_PORT quando o origin público está vazio', () => {
    delete process.env.PUBLIC_CHAT_API_ORIGIN;
    delete process.env.PORT;
    process.env.PLATFORM_PORT = '4000';
    process.env.NODE_ENV = 'development';
    expect(publicChatApiOrigin()).toBe('http://localhost:4000');
  });
});
