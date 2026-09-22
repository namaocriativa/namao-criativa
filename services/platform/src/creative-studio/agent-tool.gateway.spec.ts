import { NotFoundException } from '@nestjs/common';
import { CreativeToolGateway, truncateJson } from './agent-tool.gateway';
import { MAX_TOOL_RESULT_CHARS } from './agent.constants';
import { toolsForKind } from './agent.tools';

describe('CreativeToolGateway', () => {
  const leads = { findAll: jest.fn(), findById: jest.fn() };
  const access = { assertCanAccess: jest.fn() };
  const packages = { findAll: jest.fn() };
  const prisma = {
    imageAsset: { findMany: jest.fn() },
    videoAsset: { findMany: jest.fn() },
  };
  const imageStudio = { library: jest.fn() };
  const characters = { findAll: jest.fn(), findById: jest.fn() };

  const gateway = new CreativeToolGateway(
    leads as never,
    access as never,
    packages as never,
    prisma as never,
    imageStudio as never,
    characters as never,
  );

  const user = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Ana',
    role: 'ADMIN',
    tenantId: 't1',
    leadId: null,
    customerId: null,
    canAccessImages: true,
    canAccessVideos: true,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista tools de imagem sem propose_video', () => {
    const catalog = gateway.catalog('image');
    const names = catalog.tools.map((tool) => tool.name);
    expect(names).toContain('search_leads');
    expect(names).toContain('propose_image_generation');
    expect(names).toContain('list_characters');
    expect(names).not.toContain('propose_video_generation');
    expect(names).not.toContain('list_image_library');
    expect(toolsForKind('video').some((tool) => tool.name === 'list_image_library')).toBe(
      true,
    );
  });

  it('busca leads visíveis e recorta o resultado', async () => {
    leads.findAll.mockResolvedValue([
      {
        id: 'l1',
        name: 'Barbearia X',
        category: 'Barbearia',
        city: 'Curitiba',
        state: 'PR',
        _count: { images: 2 },
      },
      {
        id: 'l2',
        name: 'Clínica Y',
        category: 'Saúde',
        city: 'São Paulo',
        state: 'SP',
        _count: { images: 0 },
      },
    ]);
    const result = (await gateway.execute(
      'search_leads',
      { query: 'barbear' },
      { user, kind: 'image' },
    )) as { leads: Array<{ id: string }> };
    expect(result.leads).toEqual([expect.objectContaining({ id: 'l1' })]);
  });

  it('bloqueia get_lead sem acesso', async () => {
    access.assertCanAccess.mockRejectedValue(
      new NotFoundException('Perfil x não encontrado'),
    );
    await expect(
      gateway.execute('get_lead', { leadId: 'x' }, { user, kind: 'image' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa tool de vídeo no chat de imagem', async () => {
    await expect(
      gateway.execute('list_image_library', {}, { user, kind: 'image' }),
    ).rejects.toThrow('Tool não permitida');
  });

  it('monta proposta de imagem com tokens estimados', async () => {
    const result = (await gateway.execute(
      'propose_image_generation',
      { prompt: 'flyer da barbearia', leadId: 'l1', leadLabel: 'Barbearia X' },
      { user, kind: 'image', conversationId: 'c1' },
    )) as { kind: string; prompt: string; estimatedTokens: number };
    expect(result.kind).toBe('image');
    expect(result.prompt).toContain('barbearia');
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('lista personagens da biblioteca', async () => {
    characters.findAll.mockResolvedValue([
      {
        id: 'ch1',
        name: 'Luma',
        appearance: 'cabelo ruivo',
        personality: 'calma',
        assets: [{ id: 'a1' }],
      },
    ]);
    const result = (await gateway.execute(
      'list_characters',
      { query: 'luma' },
      { user, kind: 'image' },
    )) as { characters: Array<{ id: string; assetCount: number }> };
    expect(result.characters).toEqual([
      expect.objectContaining({ id: 'ch1', assetCount: 1 }),
    ]);
  });

  it('trunca JSON grande', () => {
    const bulky = { text: 'a'.repeat(MAX_TOOL_RESULT_CHARS + 10) };
    const truncated = truncateJson(bulky) as { truncated?: boolean };
    expect(truncated.truncated).toBe(true);
  });
});
