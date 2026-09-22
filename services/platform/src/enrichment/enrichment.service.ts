import { Inject, Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LeadAccountService } from '../lead-account/lead-account.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEAD_PROVIDERS,
  LeadProvider,
} from '../providers/provider.interface';
import {
  EnrichmentInput,
  ProviderImage,
  ProviderResult,
} from '../providers/provider.types';
import { StorageService } from '../storage/storage.service';
import { WebsiteFinderService } from '../providers/website-finder/website-finder.service';
import { isBlockedWebsite } from '../providers/website-finder/official-website';
import { EnrichmentDto } from './dto/enrichment.dto';
import {
  namePlaceDedupeKey,
  websiteDedupeKey,
} from './lead-dedupe';
import { LeadMergerService } from './lead-merger.service';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { STUDIO_CREATOR_SELECT } from '../owner/owner.util';
import { requireTenantId, tenantWhere } from '../tenant/tenant.util';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merger: LeadMergerService,
    private readonly storage: StorageService,
    private readonly websiteFinder: WebsiteFinderService,
    private readonly accounts: LeadAccountService,
    @Inject(LEAD_PROVIDERS)
    private readonly providers: LeadProvider[],
    private readonly access: StudioLeadAccessService,
  ) {}

  async enrich(dto: EnrichmentDto, actor: JwtUser) {
    const initial: EnrichmentInput = {
      name: dto.name.trim(),
      city: dto.city?.trim(),
      state: dto.state?.trim(),
      category: dto.category?.trim(),
      address: dto.address?.trim(),
      website: this.acceptedWebsite(dto.website),
      instagram: dto.instagram?.trim(),
      facebook: dto.facebook?.trim(),
      linkedin: dto.linkedin?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim(),
      description: dto.description?.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      rating: dto.rating,
      reviewCount: dto.reviewCount,
    };

    const existing = await this.findDuplicateLead(initial);
    if (existing) {
      if (!(await this.access.hasAccess(actor, existing.id))) {
        throw new ConflictException('Este lead já existe');
      }
      this.logger.log(
        `Dedupe: reutilizando lead ${existing.id} para "${initial.name}"`,
      );
      const droppedDirectorySite =
        !initial.website && isBlockedWebsite(existing.website);
      if (droppedDirectorySite) {
        await this.removeDirectoryCrawlArtifacts(existing.id);
      }
      await this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          // seed known fields from the new request without wiping richer data
          city: initial.city ?? existing.city,
          state: initial.state ?? existing.state,
          category: initial.category ?? existing.category,
          address: initial.address ?? existing.address,
          website: initial.website ?? this.acceptedWebsite(existing.website) ?? null,
          instagram: initial.instagram ?? existing.instagram,
          facebook: initial.facebook ?? existing.facebook,
          linkedin: initial.linkedin ?? existing.linkedin,
          phone: initial.phone ?? existing.phone,
          email: initial.email ?? existing.email,
          description: droppedDirectorySite
            ? (initial.description ?? null)
            : (initial.description ?? existing.description),
          latitude: initial.latitude ?? existing.latitude,
          longitude: initial.longitude ?? existing.longitude,
          rating: initial.rating ?? existing.rating,
          reviewCount: initial.reviewCount ?? existing.reviewCount,
        },
      });
      await this.prisma.leadSource.deleteMany({ where: { leadId: existing.id } });
      return this.runPipeline(existing.id, {
        ...initial,
        name: existing.name || initial.name,
        website:
          initial.website ?? this.acceptedWebsite(existing.website) ?? undefined,
        city: initial.city ?? existing.city ?? undefined,
        state: initial.state ?? existing.state ?? undefined,
      });
    }

    const lead = await this.prisma.lead.create({
      data: {
        name: initial.name,
        city: initial.city ?? null,
        state: initial.state ?? null,
        category: initial.category ?? null,
        address: initial.address ?? null,
        website: initial.website ?? null,
        instagram: initial.instagram ?? null,
        facebook: initial.facebook ?? null,
        linkedin: initial.linkedin ?? null,
        phone: initial.phone ?? null,
        email: initial.email ?? null,
        description: initial.description ?? null,
        latitude: initial.latitude ?? null,
        longitude: initial.longitude ?? null,
        rating: initial.rating ?? null,
        reviewCount: initial.reviewCount ?? null,
        country: 'BR',
        createdByUserId: actor.id,
        tenantId: requireTenantId(),
      },
    });

    return this.runPipeline(lead.id, initial);
  }

  /**
   * Re-runs the enrichment pipeline for an already saved lead, updating it in
   * place. Existing values are kept as the baseline, so providers only fill in
   * whatever is still missing.
   */
  async reenrich(id: string, actor: JwtUser) {
    await this.access.assertCanAccess(actor, id);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    const droppedDirectorySite = isBlockedWebsite(lead.website);
    if (droppedDirectorySite) {
      await this.removeDirectoryCrawlArtifacts(id);
    }

    const initial: EnrichmentInput = {
      name: lead.name,
      city: lead.city ?? undefined,
      state: lead.state ?? undefined,
      category: lead.category ?? undefined,
      address: lead.address ?? undefined,
      website: this.acceptedWebsite(lead.website),
      instagram: lead.instagram ?? undefined,
      facebook: lead.facebook ?? undefined,
      linkedin: lead.linkedin ?? undefined,
      phone: lead.phone ?? undefined,
      email: lead.email ?? undefined,
      description: droppedDirectorySite
        ? undefined
        : (lead.description ?? undefined),
      latitude: lead.latitude ?? undefined,
      longitude: lead.longitude ?? undefined,
      rating: lead.rating ?? undefined,
      reviewCount: lead.reviewCount ?? undefined,
    };

    // Drop the previous provider snapshots so they don't pile up on each run.
    await this.prisma.leadSource.deleteMany({ where: { leadId: id } });

    return this.runPipeline(id, initial);
  }

  private async findDuplicateLead(input: EnrichmentInput) {
    const websiteKey = websiteDedupeKey(input.website);
    const placeKey = namePlaceDedupeKey(input);

    const candidates = await this.prisma.lead.findMany({
      where: tenantWhere(),
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        website: true,
        category: true,
        address: true,
        instagram: true,
        facebook: true,
        linkedin: true,
        phone: true,
        email: true,
        description: true,
        latitude: true,
        longitude: true,
        rating: true,
        reviewCount: true,
      },
    });

    if (websiteKey) {
      const byWebsite = candidates.find(
        (lead) => websiteDedupeKey(lead.website) === websiteKey,
      );
      if (byWebsite) return byWebsite;
    }

    if (!placeKey) return null;

    return (
      candidates.find(
        (lead) =>
          namePlaceDedupeKey({
            name: lead.name,
            city: lead.city,
            state: lead.state,
          }) === placeKey,
      ) ?? null
    );
  }

  private async runPipeline(leadId: string, initial: EnrichmentInput) {
    const googleSearch = this.providers.filter((p) =>
      ['google', 'search'].includes(p.name),
    );
    const crawl4ai = this.providers.find((p) => p.name === 'crawl4ai');
    const website = this.providers.find((p) => p.name === 'website');
    const socialProviders = this.providers.filter((p) =>
      ['instagram', 'facebook', 'linkedin'].includes(p.name),
    );

    const primaryResults = await this.runProviders(googleSearch, initial);
    this.dropBlockedWebsites(primaryResults);

    // Resolve the website from any source: the user input, whatever the
    // structured providers (Google/OSM) returned, or — as a last resort — a
    // web search for the official site. Only then do we crawl it.
    const seed: EnrichmentInput = {
      ...initial,
      website: this.acceptedWebsite(initial.website),
    };
    const partialMerge = this.merger.merge(seed, primaryResults);
    let websiteUrl = this.normalizeWebsite(
      partialMerge.website ?? seed.website ?? null,
    );

    if (!websiteUrl) {
      const found = await this.websiteFinder.findWebsite(seed);
      if (found) {
        websiteUrl = this.normalizeWebsite(found);
        if (websiteUrl) {
          primaryResults.push({
            provider: 'website-finder',
            sourceUrl: websiteUrl,
            data: { website: websiteUrl },
          });
        }
      }
    }

    if (websiteUrl) {
      const crawlInput: EnrichmentInput = { ...seed, website: websiteUrl };
      const crawled = crawl4ai
        ? await this.runProviders([crawl4ai], crawlInput)
        : [];
      if (crawled.length) {
        primaryResults.push(...crawled);
      } else if (website) {
        primaryResults.push(
          ...(await this.runProviders([website], crawlInput)),
        );
      }
    }
    let merged = this.merger.merge(seed, primaryResults);

    const socialInput: EnrichmentInput = {
      ...seed,
      ...merged,
      name: merged.name ?? seed.name,
    };
    const socialResults = await this.runProviders(
      socialProviders,
      socialInput,
    );
    const allResults = [...primaryResults, ...socialResults];
    merged = this.merger.merge(seed, allResults);

    await this.persistSources(leadId, allResults);

    const images = this.collectImages(allResults);
    await this.persistImages(leadId, images);

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        name: merged.name ?? seed.name,
        category: merged.category ?? null,
        description: merged.description ?? null,
        phone: merged.phone ?? null,
        whatsapp: merged.whatsapp ?? null,
        email: merged.email ?? null,
        website: this.normalizeWebsite(merged.website) ?? null,
        address: merged.address ?? null,
        city: merged.city ?? null,
        state: merged.state ?? null,
        country: merged.country ?? 'BR',
        latitude: merged.latitude ?? null,
        longitude: merged.longitude ?? null,
        instagram: merged.instagram ?? null,
        facebook: merged.facebook ?? null,
        linkedin: merged.linkedin ?? null,
        services: merged.services
          ? (merged.services as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        rating: merged.rating ?? null,
        reviewCount: merged.reviewCount ?? null,
        metadata: merged.metadata
          ? (merged.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        images: true,
        sources: true,
        createdBy: { select: STUDIO_CREATOR_SELECT },
        studioShares: { select: { userId: true } },
      },
    });

    try {
      await this.accounts.ensureForLead(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao provisionar conta do lead ${updated.id}: ${message}`,
      );
    }

    return updated;
  }

  private acceptedWebsite(
    value: string | null | undefined,
  ): string | undefined {
    return this.normalizeWebsite(value) ?? undefined;
  }

  private dropBlockedWebsites(results: ProviderResult[]) {
    for (const result of results) {
      if (result.data.website && !this.normalizeWebsite(result.data.website)) {
        result.data.website = null;
      }
    }
  }

  private async removeDirectoryCrawlArtifacts(leadId: string) {
    const images = await this.prisma.leadImage.findMany({
      where: {
        leadId,
        source: { in: ['crawl4ai', 'website', 'website-finder'] },
      },
      select: { id: true, localPath: true },
    });
    for (const image of images) {
      await this.storage.removeImageFile(image.localPath);
    }
    if (images.length) {
      await this.prisma.leadImage.deleteMany({
        where: { id: { in: images.map((image) => image.id) } },
      });
    }
  }

  private normalizeWebsite(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(
        trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
      );
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (isBlockedWebsite(url.toString())) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  private async runProviders(
    providers: LeadProvider[],
    input: EnrichmentInput,
  ): Promise<ProviderResult[]> {
    const settled = await Promise.all(
      providers.map(async (provider) => {
        try {
          return await provider.enrich(input);
        } catch (error) {
          this.logger.warn(
            `Provider ${provider.name} failed: ${(error as Error).message}`,
          );
          return null;
        }
      }),
    );
    return settled.filter((r): r is ProviderResult => r !== null);
  }

  private async persistSources(leadId: string, results: ProviderResult[]) {
    if (!results.length) return;

    await this.prisma.leadSource.createMany({
      data: results.map((result) => ({
        leadId,
        provider: result.provider,
        url: result.sourceUrl ?? null,
        externalId: result.externalId ?? null,
        data: {
          fields: result.data,
          raw: result.raw ?? null,
        } as Prisma.InputJsonValue,
      })),
    });
  }

  private collectImages(results: ProviderResult[]): Array<
    ProviderImage & { source: string }
  > {
    const seen = new Set<string>();
    const images: Array<ProviderImage & { source: string }> = [];

    for (const result of results) {
      for (const image of result.images ?? []) {
        if (!image.url || seen.has(image.url)) continue;
        seen.add(image.url);
        images.push({ ...image, source: result.provider });
      }
    }

    return images;
  }

  private async persistImages(
    leadId: string,
    images: Array<ProviderImage & { source: string }>,
  ) {
    // On a re-run the lead may already have these images stored; skip them so
    // we don't re-download files that would be rejected as duplicates anyway.
    const existing = await this.prisma.leadImage.findMany({
      where: { leadId },
      select: { sourceUrl: true },
    });
    const alreadySaved = new Set(existing.map((img) => img.sourceUrl));

    let index = existing.length + 1;
    for (const image of images) {
      if (alreadySaved.has(image.url)) continue;
      const saved = await this.storage.downloadImage(
        leadId,
        image.url,
        index,
      );
      if (!saved) continue;

      try {
        await this.prisma.leadImage.create({
          data: {
            leadId,
            source: image.source,
            sourceUrl: saved.sourceUrl,
            localPath: saved.localPath,
            filename: saved.filename,
            mimeType: saved.mimeType,
            width: saved.width,
            height: saved.height,
          },
        });
        index += 1;
      } catch (error) {
        this.logger.debug(
          `Skip duplicate/failed image ${image.url}: ${(error as Error).message}`,
        );
      }
    }
  }
}
