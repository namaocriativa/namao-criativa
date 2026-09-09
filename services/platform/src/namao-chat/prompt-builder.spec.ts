import {
  GUEST_GREETING,
  NAMAO_AUTH_INSTRUCTIONS,
  NAMAO_GUEST_INSTRUCTIONS,
  buildNamaoPrompt,
  registeredReply,
} from './prompt-builder';

describe('namao-chat prompt-builder', () => {
  it('usa instruções de visitante e o próximo campo de cadastro', () => {
    const prompt = buildNamaoPrompt({
      mode: 'guest',
      history: [],
      userMessage: 'Quais serviços?',
      slots: { name: 'Ana' },
      registered: false,
      whatsappUrl: 'https://wa.me/5511999999999',
    });
    expect(prompt).toContain(NAMAO_GUEST_INSTRUCTIONS);
    expect(prompt).not.toContain(NAMAO_AUTH_INSTRUCTIONS);
    expect(prompt).toContain('"nextField": "email"');
    expect(prompt).toContain('Marketing');
    expect(prompt).toContain('USER MESSAGE');
    expect(prompt.indexOf('SYSTEM INSTRUCTIONS')).toBeLessThan(
      prompt.indexOf('USER MESSAGE'),
    );
  });

  it('usa contexto da conta no modo autenticado', () => {
    const prompt = buildNamaoPrompt({
      mode: 'auth',
      history: [{ role: 'assistant', content: 'Olá' }],
      userMessage: 'Cadê meu site?',
      slots: {},
      registered: true,
      account: { landingStatus: 'published', publishedOrigin: 'https://x.vercel.app' },
      whatsappUrl: null,
    });
    expect(prompt).toContain(NAMAO_AUTH_INSTRUCTIONS);
    expect(prompt).not.toContain(NAMAO_GUEST_INSTRUCTIONS);
    expect(prompt).toContain('published');
    expect(prompt).toContain('https://x.vercel.app');
  });

  it('mantém o greeting de visitante em português', () => {
    expect(GUEST_GREETING).toContain('seu nome');
  });

  it('não promete e-mail quando o envio da senha falha', () => {
    const mailed = registeredReply(
      { name: 'Ana', email: 'ana@loja.com', instagram: 'loja' },
      true,
    );
    const failed = registeredReply(
      { name: 'Ana', email: 'ana@loja.com', instagram: 'loja' },
      false,
    );
    expect(mailed).toContain('enviamos a senha');
    expect(failed).toContain('não saiu agora');
    expect(failed).toContain('WhatsApp');
  });
});
