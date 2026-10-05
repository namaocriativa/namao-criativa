import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import type { JwtUser } from '../auth/identity';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { buildLeadBrief } from '../owner/lead-brief';
import type { LeadLike } from '../owner/lead-like';
import { LlmService } from '../llm/llm.service';
import { PackagesService } from '../packages/packages.service';
import { LeadService } from '../lead/lead.service';
import { StorageService } from '../storage/storage.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import {
  CAROUSEL_INSTAGRAM_ID,
  FLYER_VENDA_LANDING_ID,
  PLAYGROUND_IMAGEM_ID,
  STATIC_INSTAGRAM_ID,
  findCreativeFeature,
  listCreativeFeatures,
} from './creative-features';
import { GenerateCarouselDto } from './dto/generate-carousel.dto';
import { GenerateFlyerDto } from './dto/generate-flyer.dto';
import { GenerateRepurposeDto } from './dto/generate-repurpose.dto';
import {
  CAROUSEL_SYSTEM_INSTRUCTION,
  buildCarouselPlannerPrompt,
  buildCarouselSlidePrompt,
  clampSlideCount,
  parseCarouselSpec,
  type CarouselSpec,
} from './carousel-instagram.planner';
import {
  FLYER_SYSTEM_INSTRUCTION,
  buildFlyerImagePrompt,
  buildFlyerPlannerPrompt,
  parseFlyerSpec,
  type FlyerPackageInput,
  type FlyerSpec,
} from './flyer-venda.planner';
import { resolveNamaoLogoPath } from './namao-logo';
import {
  STATIC_SYSTEM_INSTRUCTION,
  buildRepurposePlannerPrompt,
  buildStaticPostPrompt,
  parseRepurposeSpec,
  type RepurposeSpec,
} from './repurpose.planner';

const MAX_LEAD_PHOTOS = 2;

@Injectable()
export class CreativeStudioService {
  constructor(
    private readonly llm: LlmService,
    private readonly leads: LeadService,
    private readonly packages: PackagesService,
    private readonly access: StudioLeadAccessService,
    private readonly imageStudio: ImageStudioService,
    private readonly storage: StorageService,
  ) {}

  listFeatures() {
    return {
      features: listCreativeFeatures(),
      defaultFeatureId: PLAYGROUND_IMAGEM_ID,
    };
  }

  async generateFlyer(dto: GenerateFlyerDto, user: JwtUser) {
    const feature = findCreativeFeature(FLYER_VENDA_LANDING_ID);
    if (!feature) {
      throw new NotFoundException('Feature não encontrada');
    }

    const packageIds = uniqueIds(dto.packageIds);
    if (!packageIds.length) {
      throw new BadRequestException('Selecione ao menos um pacote');
    }
    if (packageIds.length > 2) {
      throw new BadRequestException('Selecione no máximo dois pacotes');
    }

    await this.access.assertCanAccess(user, dto.leadId);
    return runWithAiUsage(
      {
        feature: AI_FEATURES.flyer,
        userId: user.id,
        leadId: dto.leadId,
      },
      () => this.generateFlyerBody(dto, user, feature, packageIds),
    );
  }

  private async generateFlyerBody(
    dto: GenerateFlyerDto,
    user: JwtUser,
    feature: NonNullable<ReturnType<typeof findCreativeFeature>>,
    packageIds: string[],
  ) {
    const lead = (await this.leads.findById(dto.leadId, user)) as LeadLike;
    const packages = await this.loadPackages(packageIds);
    const photos = leadPhotos(lead).slice(0, MAX_LEAD_PHOTOS);
    const notes = dto.notes?.trim() || '';
    const brief = buildLeadBrief(lead);
    const plannerContext = {
      brief,
      packages,
      notes,
      photoCount: photos.length,
    };

    let spec: FlyerSpec;
    try {
      spec = await this.llm.generateJson(
        buildFlyerPlannerPrompt(plannerContext),
        (value) => parseFlyerSpec(value, plannerContext),
        {
          role: 'plan',
          temperature: 0.2,
          expectedShape: 'FlyerSpec',
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao planejar o flyer';
      throw new BadGatewayException(message);
    }

    const defaults = feature.defaults || {};
    const skillRun = {
      leadId: dto.leadId,
      leadLabel: brief.name,
      packageIds,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        price: pkg.price ?? null,
        promoPrice: pkg.promoPrice ?? null,
        currency: pkg.currency ?? null,
      })),
      notes,
      spec,
    };
    const project = await this.imageStudio.create(
      {
        name: `Flyer · ${brief.name}`,
        featureId: FLYER_VENDA_LANDING_ID,
        model: defaults.model,
        aspectRatio: defaults.aspectRatio || '2:3',
        imageSize: defaults.imageSize || '2K',
        temperature: 0.4,
        systemInstruction: FLYER_SYSTEM_INSTRUCTION,
        googleSearch: false,
        skillRun,
      },
      user.id,
    );

    const referenceAssetIds = await this.attachReferences(project.id, photos);

    const generated = await this.imageStudio.generate(project.id, {
      prompt: buildFlyerImagePrompt(spec),
      model: defaults.model,
      aspectRatio: defaults.aspectRatio || '2:3',
      imageSize: defaults.imageSize || '2K',
      temperature: 0.4,
      systemInstruction: FLYER_SYSTEM_INSTRUCTION,
      googleSearch: false,
      referenceAssetIds,
    });

    return {
      featureId: FLYER_VENDA_LANDING_ID,
      projectId: project.id,
      spec,
      settings: generated.settings,
      userMessage: generated.userMessage,
      modelMessage: generated.modelMessage,
      assets: generated.assets,
    };
  }

  async generateCarousel(dto: GenerateCarouselDto, user: JwtUser) {
    const feature = findCreativeFeature(CAROUSEL_INSTAGRAM_ID);
    if (!feature) {
      throw new NotFoundException('Feature não encontrada');
    }

    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new BadRequestException('Informe o briefing do carrossel');
    }
    const notes = dto.notes?.trim() || '';
    const slideCount = clampSlideCount(dto.slideCount);
    const plannerContext = { prompt, notes, slideCount };
    return runWithAiUsage(
      {
        feature: AI_FEATURES.carousel,
        userId: user.id,
      },
      () => this.generateCarouselBody(dto, user, feature, plannerContext),
    );
  }

  private async generateCarouselBody(
    dto: GenerateCarouselDto,
    user: JwtUser,
    feature: NonNullable<ReturnType<typeof findCreativeFeature>>,
    plannerContext: { prompt: string; notes: string; slideCount: number },
  ) {
    let spec: CarouselSpec;
    try {
      spec = await this.llm.generateJson(
        buildCarouselPlannerPrompt(plannerContext),
        (value) => parseCarouselSpec(value, plannerContext),
        {
          role: 'plan',
          temperature: 0.2,
          expectedShape: 'CarouselSpec',
          ...(dto.planModel?.trim() ? { model: dto.planModel.trim() } : {}),
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao planejar o carrossel';
      throw new BadGatewayException(message);
    }

    const { prompt, notes } = plannerContext;
    const defaults = feature.defaults || {};
    const aspectRatio = defaults.aspectRatio || '4:5';
    const imageSize = dto.imageSize?.trim() || defaults.imageSize || '2K';
    const imageModel = dto.model?.trim() || defaults.model;
    const baseSkillRun = {
      prompt,
      notes,
      slideCount: spec.slides.length,
      completedSlides: 0,
      spec,
    };
    const project = await this.imageStudio.create(
      {
        name: `Carrossel · ${prompt.slice(0, 60)}`,
        featureId: CAROUSEL_INSTAGRAM_ID,
        model: imageModel,
        aspectRatio,
        imageSize,
        temperature: 0.4,
        systemInstruction: CAROUSEL_SYSTEM_INSTRUCTION,
        googleSearch: false,
        skillRun: baseSkillRun,
      },
      user.id,
    );

    const assets: Array<{ id: string; localPath?: string }> = [];
    let lastGeneratedId: string | undefined;
    let error: string | undefined;
    const brandRefIds: string[] = [];
    if (dto.brandReferences?.length) {
      const created = await this.imageStudio.addReferences(
        project.id,
        dto.brandReferences,
      );
      for (const asset of created) {
        if (asset?.id) brandRefIds.push(asset.id);
      }
    }
    for (const slide of spec.slides) {
      try {
        const referenceAssetIds = [
          ...brandRefIds,
          ...(lastGeneratedId ? [lastGeneratedId] : []),
        ];
        const generated = await this.imageStudio.generate(project.id, {
          prompt: buildCarouselSlidePrompt(spec, slide, spec.slides.length),
          model: imageModel,
          aspectRatio,
          imageSize,
          temperature: 0.4,
          systemInstruction: CAROUSEL_SYSTEM_INSTRUCTION,
          googleSearch: false,
          referenceAssetIds,
        });
        const next = (generated.assets || []).find(
          (asset: { kind?: string; id?: string; localPath?: string }) =>
            asset.kind === 'generated' && asset.id,
        );
        if (next?.id) {
          lastGeneratedId = next.id;
          assets.push({
            id: next.id,
            ...(next.localPath ? { localPath: next.localPath } : {}),
          });
        }
        await this.imageStudio.update(project.id, {
          skillRun: {
            ...baseSkillRun,
            completedSlides: assets.length,
          },
        });
      } catch (err) {
        error = err instanceof Error ? err.message : 'Falha ao gerar um slide';
        await this.imageStudio.update(project.id, {
          skillRun: {
            ...baseSkillRun,
            completedSlides: assets.length,
            error,
          },
        });
        break;
      }
    }

    return {
      featureId: CAROUSEL_INSTAGRAM_ID,
      projectId: project.id,
      spec,
      completedSlides: assets.length,
      error,
      assets,
    };
  }

  async generateRepurpose(dto: GenerateRepurposeDto, user: JwtUser) {
    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new BadRequestException('Informe o briefing do pack');
    }
    const notes = dto.notes?.trim() || '';
    let brief: ReturnType<typeof buildLeadBrief> | undefined;
    if (dto.leadId?.trim()) {
      await this.access.assertCanAccess(user, dto.leadId);
      const lead = (await this.leads.findById(dto.leadId, user)) as LeadLike;
      brief = buildLeadBrief(lead);
    }
    const plannerContext = { prompt, notes, brief };
    return runWithAiUsage(
      {
        feature: AI_FEATURES.repurpose,
        userId: user.id,
        leadId: dto.leadId?.trim() || null,
      },
      () => this.generateRepurposeBody(dto, user, plannerContext),
    );
  }

  private async generateRepurposeBody(
    dto: GenerateRepurposeDto,
    user: JwtUser,
    plannerContext: {
      prompt: string;
      notes: string;
      brief?: ReturnType<typeof buildLeadBrief>;
    },
  ) {
    const { prompt, notes, brief } = plannerContext;
    let spec: RepurposeSpec;
    try {
      spec = await this.llm.generateJson(
        buildRepurposePlannerPrompt(plannerContext),
        (value) => parseRepurposeSpec(value, plannerContext),
        {
          role: 'plan',
          temperature: 0.2,
          expectedShape: 'RepurposeSpec',
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao planejar o pack';
      throw new BadGatewayException(message);
    }

    const carousel = await this.generateCarousel(
      {
        prompt: spec.carousel.prompt,
        slideCount: 5,
        notes: spec.carousel.notes,
      },
      user,
    );

    const staticFeature = findCreativeFeature(STATIC_INSTAGRAM_ID);
    const defaults = staticFeature?.defaults || {};
    const staticProject = await this.imageStudio.create(
      {
        name: `Estático · ${spec.static.headline.slice(0, 60)}`,
        featureId: STATIC_INSTAGRAM_ID,
        model: defaults.model,
        aspectRatio: defaults.aspectRatio || '4:5',
        imageSize: defaults.imageSize || '2K',
        temperature: 0.4,
        systemInstruction: STATIC_SYSTEM_INSTRUCTION,
        googleSearch: false,
        skillRun: {
          prompt,
          notes,
          leadId: dto.leadId,
          leadLabel: brief?.name,
          spec: spec.static,
        },
      },
      user.id,
    );
    const staticGenerated = await this.imageStudio.generate(staticProject.id, {
      prompt: buildStaticPostPrompt(spec.static),
      model: defaults.model,
      aspectRatio: defaults.aspectRatio || '4:5',
      imageSize: defaults.imageSize || '2K',
      temperature: 0.4,
      systemInstruction: STATIC_SYSTEM_INSTRUCTION,
      googleSearch: false,
    });

    await this.imageStudio.update(carousel.projectId, {
      skillRun: {
        prompt: spec.carousel.prompt,
        notes: spec.carousel.notes,
        slideCount: 5,
        completedSlides: carousel.completedSlides,
        spec: carousel.spec,
        error: carousel.error,
        pack: {
          staticProjectId: staticProject.id,
          reel: spec.reel,
          static: spec.static,
        },
      },
    });

    return {
      spec,
      carousel,
      staticProjectId: staticProject.id,
      staticAssets: staticGenerated.assets,
      reel: spec.reel,
      characterId: dto.characterId || null,
    };
  }

  private async loadPackages(ids: string[]): Promise<FlyerPackageInput[]> {
    const packages: FlyerPackageInput[] = [];
    for (const id of ids) {
      const pkg = await this.packages.findById(id);
      packages.push({
        id: pkg.id,
        name: pkg.name,
        summary: pkg.summary,
        description: pkg.description,
        price: pkg.price == null ? null : Number(pkg.price),
        promoPrice: pkg.promoPrice == null ? null : Number(pkg.promoPrice),
        currency: pkg.currency,
        benefits: Array.isArray(pkg.benefits)
          ? pkg.benefits.map((item) => String(item).trim()).filter(Boolean)
          : [],
      });
    }
    return packages;
  }

  private async attachReferences(
    projectId: string,
    photos: Array<{ localPath: string; filename?: string | null; mimeType?: string | null }>,
  ): Promise<string[]> {
    const files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }> = [];

    const logoPath = resolveNamaoLogoPath();
    if (logoPath) {
      const buffer = await readFile(logoPath);
      files.push({
        buffer,
        originalname: 'namao-logo.png',
        mimetype: 'image/png',
        size: buffer.length,
      });
    }

    for (const photo of photos) {
      const buffer = await this.storage.readStorageFile(photo.localPath);
      if (!buffer?.length) continue;
      const mime = (photo.mimeType || 'image/jpeg').split(';')[0].trim();
      files.push({
        buffer,
        originalname: photo.filename || 'lead-photo.jpg',
        mimetype: mime || 'image/jpeg',
        size: buffer.length,
      });
    }

    if (!files.length) return [];
    const created = await this.imageStudio.addReferences(projectId, files);
    return created.map((asset) => asset.id);
  }
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    const value = String(id || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

function leadPhotos(lead: LeadLike): Array<{
  localPath: string;
  filename?: string | null;
  mimeType?: string | null;
}> {
  return (lead.images || []).flatMap((image) => {
    const localPath = String(image.localPath || '').trim();
    if (!localPath) return [];
    if (/logo/i.test(`${image.filename || ''} ${image.sourceUrl || ''}`)) {
      return [];
    }
    return [
      {
        localPath,
        filename: image.filename,
        mimeType: (image as { mimeType?: string | null }).mimeType,
      },
    ];
  });
}
