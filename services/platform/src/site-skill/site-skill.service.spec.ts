import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runWithTenant } from '../tenant/tenant-context';
import { SiteSkillService } from './site-skill.service';

describe('SiteSkillService', () => {
  const prisma = {
    siteSkillJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    instagramSkillJob: { findFirst: jest.fn() },
  };
  const config = { get: jest.fn() };
  const owners = {
    requireDetail: jest.fn(),
    update: jest.fn(),
  };
  const access = { assertCanAccess: jest.fn() };
  const llm = {
    modelFor: jest.fn(() => 'gemini-2.5-pro'),
    generateJson: jest.fn(),
  };
  const storage = { readStorageFile: jest.fn() };
  const github = {
    createRepo: jest.fn(),
    pushDirectory: jest.fn(),
    cloneRepo: jest.fn(),
  };
  const websites = { attachGeneratedRepo: jest.fn() };
  const service = new SiteSkillService(
    prisma as never,
    config as never,
    owners as never,
    access as never,
    llm as never,
    storage as never,
    github as never,
    websites as never,
  );

  const spies: Array<jest.SpyInstance> = [];

  beforeEach(() => {
    jest.resetAllMocks();
    llm.modelFor.mockReturnValue('gemini-2.5-pro');
  });

  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    spies.length = 0;
  });

  it('recusa lead e cliente juntos', async () => {
    await expect(
      service.start({
        user: { id: 'u1' } as never,
        leadId: 'l1',
        customerId: 'c1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cria o job e não clona se websites/ não existe', async () => {
    spies.push(
      jest
        .spyOn(service as never, 'run' as never)
        .mockResolvedValue(undefined as never),
    );
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      landingSlug: 'firma-lead-1',
      images: [],
    });
    prisma.siteSkillJob.create.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      stage: 'queued',
      log: [],
      error: null,
      model: 'gemini-2.5-pro',
      notes: '',
      repo: '',
      slug: 'firma-lead-1',
    });
    await runWithTenant('tenant-1', () =>
      service.start({
        user: { id: 'u1' } as never,
        leadId: 'lead-1',
        notes: 'tom escuro',
      }),
    );
    expect(prisma.siteSkillJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          customerId: null,
          tenantId: 'tenant-1',
          slug: 'firma-lead-1',
        }),
      }),
    );
  });

  it('pula clone quando o diretório não é gravável', async () => {
    config.get.mockReturnValue('/tmp/namao-missing-websites-dir');
    await expect(service.cloneLocal('namaocriativa', 'x', 'x')).resolves.toBe(
      false,
    );
    expect(github.cloneRepo).not.toHaveBeenCalled();
  });

  it('cria o repo, faz push, vincula e não clona se websites/ não existe', async () => {
    const projectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'namao-site-spec-'),
    );
    spies.push(
      jest
        .spyOn(service as never, 'scaffold' as never)
        .mockResolvedValue(projectDir as never),
      jest
        .spyOn(service as never, 'writeFiles' as never)
        .mockResolvedValue(undefined as never),
      jest
        .spyOn(service as never, 'mergeDeps' as never)
        .mockResolvedValue(undefined as never),
      jest
        .spyOn(service as never, 'copyMedia' as never)
        .mockResolvedValue(undefined as never),
      jest
        .spyOn(service as never, 'writeCdYml' as never)
        .mockResolvedValue(undefined as never),
    );
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      category: 'advocacia',
      landingSlug: 'firma',
      images: [],
    });
    prisma.siteSkillJob.findFirst.mockResolvedValue({
      id: 'job-1',
      slug: 'firma',
      model: 'gemini-2.5-pro',
      notes: 'tom escuro',
    });
    prisma.siteSkillJob.findUnique.mockResolvedValue({ id: 'job-1', log: [] });
    prisma.siteSkillJob.update.mockResolvedValue({});
    llm.generateJson
      .mockResolvedValueOnce({ prompt: 'x'.repeat(80) })
      .mockResolvedValueOnce({
        files: { 'src/App.tsx': 'export default function App(){return null}' },
        extraDeps: [],
      });
    github.createRepo.mockResolvedValue({ id: 'namaocriativa/firma' });
    config.get.mockReturnValue('/tmp/namao-missing-websites-dir');

    await runWithTenant('tenant-1', () =>
      (
        service as unknown as {
          run: (id: string, ctx: unknown) => Promise<void>;
        }
      ).run('job-1', {
        ownerId: 'lead-1',
        kind: 'lead',
        imageIds: [],
        uploads: [],
      }),
    );

    const failed = prisma.siteSkillJob.update.mock.calls.find(
      (call) => call[0]?.data?.status === 'error',
    );
    expect(failed).toBeUndefined();
    expect(github.createRepo).toHaveBeenCalledWith('firma');
    expect(github.pushDirectory).toHaveBeenCalledWith(
      projectDir,
      'namaocriativa',
      'firma',
    );
    expect(websites.attachGeneratedRepo).toHaveBeenCalledWith(
      'lead',
      'lead-1',
      'namaocriativa/firma',
    );
    expect(github.cloneRepo).not.toHaveBeenCalled();
  });

  it('monta o briefing sem chamar a LLM', async () => {
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      whatsapp: '11999990000',
      images: [],
    });
    prisma.instagramSkillJob.findFirst.mockResolvedValue({
      id: 'ig-1',
      createdAt: new Date('2026-09-28T12:00:00.000Z'),
      report: {
        overview: {
          who: 'Firma',
          sells: 'Cortes',
          audience: 'Curitiba',
          stage: 'marca',
        },
      },
    });
    const brief = await runWithTenant('tenant-1', () =>
      service.briefFor({ id: 'u1' } as never, 'lead-1'),
    );
    expect(llm.generateJson).not.toHaveBeenCalled();
    expect(brief.igReady).toBe(true);
    expect(
      brief.facts.find((fact) => fact.key === 'whatsapp')?.confidence,
    ).toBe('confirmed');
    expect(
      brief.facts.find((fact) => fact.key === 'audience')?.confidence,
    ).toBe('identified');
  });

  it('propõe a estrutura no papel plan', async () => {
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      images: [],
    });
    prisma.instagramSkillJob.findFirst.mockResolvedValue(null);
    llm.generateJson.mockImplementation(
      (_prompt: string, validate: (value: unknown) => unknown) =>
        validate({
          sections: [
            { id: 'hero', kind: 'hero', title: 'Hero', purpose: 'Valor' },
            {
              id: 'contato',
              kind: 'contact',
              title: 'Contato',
              purpose: 'Canal',
            },
          ],
          gaps: [],
        }),
    );
    const proposal = await runWithTenant('tenant-1', () =>
      service.propose({
        user: { id: 'u1' } as never,
        leadId: 'lead-1',
        objective: 'present',
      }),
    );
    expect(proposal.objective).toBe('present');
    expect(proposal.sections).toHaveLength(2);
    expect(proposal.gaps.some((gap) => gap.key === 'whatsapp')).toBe(true);
    expect(llm.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('Apresentar o negócio'),
      expect.any(Function),
      expect.objectContaining({ role: 'plan' }),
    );
    await expect(
      runWithTenant('tenant-1', () =>
        service.propose({
          user: { id: 'u1' } as never,
          leadId: 'lead-1',
          objective: 'nope',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grava o briefing aprovado no job', async () => {
    spies.push(
      jest
        .spyOn(service as never, 'run' as never)
        .mockResolvedValue(undefined as never),
    );
    owners.requireDetail.mockResolvedValue({
      id: 'lead-1',
      name: 'Firma',
      landingSlug: 'firma',
      images: [],
    });
    prisma.siteSkillJob.create.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      stage: 'queued',
      log: [],
      error: null,
      model: 'gemini-2.5-pro',
      notes: '',
      repo: '',
      slug: 'firma',
    });
    await runWithTenant('tenant-1', () =>
      service.start({
        user: { id: 'u1' } as never,
        leadId: 'lead-1',
        notes: 'tom sóbrio',
        brief: {
          objective: 'leads',
          sections: [
            { id: 'a', kind: 'hero', title: 'Hero', purpose: 'Valor' },
            { id: 'b', kind: 'contact', title: 'Contato', purpose: 'Canal' },
          ],
          gaps: [],
          images: [{ filename: 'sala.jpg', section: 'hero', kind: 'photo' }],
          notes: 'tom sóbrio',
        },
      }),
    );
    expect(prisma.siteSkillJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: 'tom sóbrio',
          brief: expect.objectContaining({ objective: 'leads' }),
        }),
      }),
    );
  });
});
