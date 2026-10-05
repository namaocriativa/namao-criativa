import { runWithTenant } from '../tenant/tenant-context';
import { createEmptyEditDocument } from './edit-document';
import { VideoEditService } from './video-edit.service';

describe('VideoEditService', () => {
  const prisma = {
    creativeVideoEditProject: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    creativeVideoEditMedia: {
      create: jest.fn(),
    },
    videoProject: { findMany: jest.fn() },
    imageProject: { findMany: jest.fn() },
    creativeVideoLivreClip: { findMany: jest.fn() },
    creativeStartEndClip: { findMany: jest.fn() },
    creativeMovie: { findMany: jest.fn() },
    creativeUgcClip: { findMany: jest.fn() },
  };
  const storage = {
    saveVideoEditAsset: jest.fn(),
    removeVideoEditDir: jest.fn(),
  };

  const service = new VideoEditService(prisma as never, storage as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a project with empty document', async () => {
    const doc = createEmptyEditDocument();
    prisma.creativeVideoEditProject.create.mockResolvedValue({
      id: 'p1',
      name: 'Novo',
      document: doc,
      media: [],
    });

    const result = await runWithTenant('tenant-1', () =>
      service.create({ name: 'Novo' }, 'user-1'),
    );

    expect(prisma.creativeVideoEditProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Novo',
          createdByUserId: 'user-1',
        }),
      }),
    );
    expect(result.id).toBe('p1');
  });

  it('uploads media into project storage', async () => {
    prisma.creativeVideoEditProject.findUnique.mockResolvedValue({
      id: 'p1',
      tenantId: 'tenant-1',
      media: [],
    });
    storage.saveVideoEditAsset.mockResolvedValue({
      filename: 'upload-1.mp4',
      localPath: 'storage/video-edits/p1/upload-1.mp4',
      mimeType: 'video/mp4',
      sourceUrl: 'upload://x',
    });
    prisma.creativeVideoEditMedia.create.mockResolvedValue({
      id: 'm1',
      projectId: 'p1',
      filename: 'upload-1.mp4',
      localPath: 'storage/video-edits/p1/upload-1.mp4',
      mimeType: 'video/mp4',
      source: 'upload',
    });

    const media = await runWithTenant('tenant-1', () =>
      service.uploadMedia('p1', {
        buffer: Buffer.from('video'),
        originalname: 'clip.mp4',
        mimetype: 'video/mp4',
        size: 5,
      }),
    );

    expect(storage.saveVideoEditAsset).toHaveBeenCalled();
    expect(media.id).toBe('m1');
  });

  it('aggregates library sources', async () => {
    prisma.videoProject.findMany.mockResolvedValue([
      {
        name: 'Chat',
        assets: [
          {
            id: 'a1',
            filename: 'out.mp4',
            localPath: 'storage/video-projects/x/out.mp4',
            mimeType: 'video/mp4',
            createdAt: new Date('2026-01-01'),
          },
        ],
      },
    ]);
    prisma.imageProject.findMany.mockResolvedValue([]);
    prisma.creativeVideoLivreClip.findMany.mockResolvedValue([]);
    prisma.creativeStartEndClip.findMany.mockResolvedValue([]);
    prisma.creativeMovie.findMany.mockResolvedValue([]);
    prisma.creativeUgcClip.findMany.mockResolvedValue([]);

    const result = await runWithTenant('tenant-1', () =>
      service.librarySources(),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].origin).toBe('video-projects');
  });
});
