import { CalendarPublisher } from './calendar.publisher';
import { INSTAGRAM_OAUTH_SCOPES } from '../instagram/instagram-graph.client';

describe('CalendarPublisher', () => {
  const calendar = {
    findDue: jest.fn(),
    claimForPublish: jest.fn(),
    findById: jest.fn(),
    syncPostStatus: jest.fn(),
  };
  const prisma = {
    contentCalendarTarget: { update: jest.fn() },
    instagramConnection: { findFirst: jest.fn() },
  };
  const graph = {
    configured: jest.fn(() => true),
    createMediaContainer: jest.fn(),
    getContainerStatus: jest.fn(),
    publishContainer: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PUBLIC_CHAT_API_ORIGIN') return 'https://api.namaocriativa.com.br';
      if (key === 'JWT_SECRET') return 'secret';
      return undefined;
    }),
  };

  const publisher = new CalendarPublisher(
    calendar as never,
    prisma as never,
    graph as never,
    config as never,
  );

  const basePost = {
    id: 'post-1',
    title: 'Noite',
    caption: 'Vamos nessa',
    leadId: 'lead-1',
    customerId: null,
    assets: [
      {
        id: 'asset-1',
        kind: 'image',
        localPath: 'storage/calendar/post-1/a.jpg',
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    targets: [
      { id: 't-ig', platform: 'instagram', status: 'pending' },
      { id: 't-yt', platform: 'youtube', status: 'pending' },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'PUBLIC_CHAT_API_ORIGIN') return 'https://api.namaocriativa.com.br';
      if (key === 'JWT_SECRET') return 'secret';
      return undefined;
    });
    graph.configured.mockReturnValue(true);
  });

  it('publica Instagram via Graph e deixa YouTube em publicação manual', async () => {
    calendar.claimForPublish.mockResolvedValue(true);
    calendar.findById.mockResolvedValue(basePost);
    calendar.syncPostStatus.mockResolvedValue({ id: 'post-1' });
    prisma.instagramConnection.findFirst.mockResolvedValue({
      igUserId: 'ig-1',
      accessToken: 'token',
      scopes: INSTAGRAM_OAUTH_SCOPES.join(','),
    });
    graph.createMediaContainer.mockResolvedValue('container-1');
    graph.getContainerStatus.mockResolvedValue({ statusCode: 'FINISHED' });
    graph.publishContainer.mockResolvedValue({
      id: 'media-1',
      permalink: 'https://instagram.com/p/abc',
    });
    prisma.contentCalendarTarget.update.mockResolvedValue({});

    await publisher.publishPost('post-1');

    expect(graph.createMediaContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        igUserId: 'ig-1',
        caption: 'Vamos nessa',
        imageUrl: expect.stringContaining('/public/calendar-assets/asset-1'),
      }),
    );
    expect(graph.publishContainer).toHaveBeenCalled();
    expect(prisma.contentCalendarTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-ig' },
        data: expect.objectContaining({
          status: 'published',
          externalId: 'media-1',
        }),
      }),
    );
    expect(prisma.contentCalendarTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-yt' },
        data: expect.objectContaining({ status: 'ready_manual' }),
      }),
    );
  });

  it('pede conexão quando o lead não tem Instagram', async () => {
    calendar.claimForPublish.mockResolvedValue(true);
    calendar.findById.mockResolvedValue(basePost);
    calendar.syncPostStatus.mockResolvedValue({ id: 'post-1' });
    prisma.instagramConnection.findFirst.mockResolvedValue(null);
    prisma.contentCalendarTarget.update.mockResolvedValue({});

    await publisher.publishPost('post-1');

    expect(graph.createMediaContainer).not.toHaveBeenCalled();
    expect(prisma.contentCalendarTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-ig' },
        data: expect.objectContaining({ status: 'needs_connection' }),
      }),
    );
  });
});
