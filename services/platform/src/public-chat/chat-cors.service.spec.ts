import { ChatCorsService } from './chat-cors.service';

describe('ChatCorsService', () => {
  const owners = {
    findByPublishedOrigin: jest.fn(),
  };
  const service = new ChatCorsService(owners as never);

  beforeEach(() => {
    owners.findByPublishedOrigin.mockReset();
  });

  it('libera request sem Origin', async () => {
    await expect(service.isAllowed(undefined, '/leads')).resolves.toBe(true);
    expect(owners.findByPublishedOrigin).not.toHaveBeenCalled();
  });

  it('não consulta landing publicada fora de /public/chat', async () => {
    await expect(
      service.isAllowed('https://lp.example', '/auth/login'),
    ).resolves.toBe(false);
    expect(owners.findByPublishedOrigin).not.toHaveBeenCalled();
  });

  it('consulta landing publicada só em /public/chat', async () => {
    owners.findByPublishedOrigin.mockResolvedValue({ id: 'lead_1' });
    await expect(
      service.isAllowed('https://lp.example', '/public/chat/session'),
    ).resolves.toBe(true);
    expect(owners.findByPublishedOrigin).toHaveBeenCalledWith(
      'https://lp.example',
    );
  });
});
