import { NotFoundException } from '@nestjs/common';
import { runWithTenant } from '../tenant/tenant-context';
import { ProfileCharacterService } from './profile-character.service';

describe('ProfileCharacterService', () => {
  const prisma = {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creativeCharacter: {
      findUnique: jest.fn(),
    },
  };
  const owners = {
    requireProfile: jest.fn(),
  };
  const service = new ProfileCharacterService(
    prisma as never,
    owners as never,
  );

  const character = {
    id: 'ch-1',
    tenantId: 'tenant-1',
    name: 'Luma',
    appearance: 'cabelo ruivo',
    personality: '',
    identityPrompt: '',
    assets: [],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    owners.requireProfile.mockResolvedValue({ kind: 'lead', id: 'lead-1' });
  });

  it('get retorna null sem vínculo', async () => {
    prisma.lead.findUnique.mockResolvedValue({ characterId: null });
    await expect(
      runWithTenant('tenant-1', () => service.get('lead-1')),
    ).resolves.toEqual({ characterId: null, character: null });
  });

  it('put linka personagem do mesmo tenant', async () => {
    prisma.creativeCharacter.findUnique.mockResolvedValue(character);
    prisma.lead.update.mockResolvedValue({});
    const result = await runWithTenant('tenant-1', () =>
      service.put('lead-1', { characterId: 'ch-1' }),
    );
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { characterId: 'ch-1' },
    });
    expect(result).toEqual({ characterId: 'ch-1', character });
  });

  it('put desvincula com null', async () => {
    prisma.lead.update.mockResolvedValue({});
    const result = await runWithTenant('tenant-1', () =>
      service.put('lead-1', { characterId: null }),
    );
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { characterId: null },
    });
    expect(result).toEqual({ characterId: null, character: null });
    expect(prisma.creativeCharacter.findUnique).not.toHaveBeenCalled();
  });

  it('put rejeita personagem inexistente', async () => {
    prisma.creativeCharacter.findUnique.mockResolvedValue(null);
    await expect(
      runWithTenant('tenant-1', () =>
        service.put('lead-1', { characterId: 'missing' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('put rejeita personagem de outro tenant', async () => {
    prisma.creativeCharacter.findUnique.mockResolvedValue({
      ...character,
      tenantId: 'other',
    });
    await expect(
      runWithTenant('tenant-1', () =>
        service.put('lead-1', { characterId: 'ch-1' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
