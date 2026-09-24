import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import type { JwtUser } from '../auth/identity';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { buildLeadBrief } from '../landing/lead-brief';
import type { LeadLike } from '../landing/prompt.builder';
import { LlmService } from '../llm/llm.service';
import { PackagesService } from '../packages/packages.service';
import { LeadService } from '../lead/lead.service';
import { StorageService } from '../storage/storage.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import {
  CAROUSEL_INSTAGRAM_ID,
  FLYER_VENDA_LANDING_ID,
  PLAYGROUND_IMAGEM_ID,
  findCreativeFeature,
  listCreativeFeatures,
} from './creative-features';
import { GenerateCarouselDto } from './dto/generate-carousel.dto';
import { GenerateFlyerDto } from './dto/generate-flyer.dto';
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

    let spec: CarouselSpec;
    try {
      spec = await this.llm.generateJson(
        buildCarouselPlannerPrompt(plannerContext),
        (value) => parseCarouselSpec(value, plannerContext),
        {
          role: 'plan',
          temperature: 0.2,
          expectedShape: 'CarouselSpec',
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao planejar o carrossel';
      throw new BadGatewayException(message);
    }

    const defaults = feature.defaults || {};
    const aspectRatio = defaults.aspectRatio || '4:5';
    const imageSize = defaults.imageSize || '2K';
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
        model: defaults.model,
        aspectRatio,
        imageSize,
        temperature: 0.4,
        systemInstruction: CAROUSEL_SYSTEM_INSTRUCTION,
        googleSearch: false,
        skillRun: baseSkillRun,
      },
      user.id,
    );

    const assets: Array<{ id: string }> = [];
    let lastGeneratedId: string | undefined;
    let error: string | undefined;
    for (const slide of spec.slides) {
      try {
        const generated = await this.imageStudio.generate(project.id, {
          prompt: buildCarouselSlidePrompt(spec, slide, spec.slides.length),
          model: defaults.model,
          aspectRatio,
          imageSize,
          temperature: 0.4,
          systemInstruction: CAROUSEL_SYSTEM_INSTRUCTION,
          googleSearch: false,
          referenceAssetIds: lastGeneratedId ? [lastGeneratedId] : [],
        });
        const next = (generated.assets || []).find(
          (asset: { kind?: string; id?: string }) =>
            asset.kind === 'generated' && asset.id,
        );
        if (next?.id) {
          lastGeneratedId = next.id;
          assets.push({ id: next.id });
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
