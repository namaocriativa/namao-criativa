import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_DETAIL_INCLUDE,
  PROFILE_SCALAR_SELECT,
  type OwnerKind,
} from './owner.util';

export type OwnerProfile = {
  kind: OwnerKind;
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  services: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  generateConfig: Prisma.JsonValue;
  landingSlug: string | null;
  landingStatus: string;
  landingBuiltAt: Date | null;
  activeLandingJobId: string | null;
  publicSiteId: string | null;
  chatEnabled: boolean;
  publishedOrigin: string | null;
  vercelProjectId: string | null;
  vercelDeploymentId: string | null;
  fromPublicSignup: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OwnerLookup {
  constructor(private readonly prisma: PrismaService) {}

  async kindOf(id: string): Promise<OwnerKind | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true },
    });
    if (lead) return 'lead';
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    return customer ? 'customer' : null;
  }

  async requireKind(id: string): Promise<OwnerKind> {
    const kind = await this.kindOf(id);
    if (!kind) {
      throw new NotFoundException(`Perfil ${id} não encontrado`);
    }
    return kind;
  }

  async findProfile(id: string): Promise<OwnerProfile | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: PROFILE_SCALAR_SELECT,
    });
    if (lead) return { kind: 'lead', ...lead };
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: PROFILE_SCALAR_SELECT,
    });
    if (customer) return { kind: 'customer', ...customer };
    return null;
  }

  async requireProfile(id: string): Promise<OwnerProfile> {
    const profile = await this.findProfile(id);
    if (!profile) {
      throw new NotFoundException(`Perfil ${id} não encontrado`);
    }
    return profile;
  }

  async requireDetail(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: PROFILE_DETAIL_INCLUDE,
    });
    if (lead) return lead;
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: PROFILE_DETAIL_INCLUDE,
    });
    if (customer) return customer;
    throw new NotFoundException(`Perfil ${id} não encontrado`);
  }

  async findByPublicSiteId(siteId: string) {
    const select = {
      id: true,
      chatEnabled: true,
      publicSiteId: true,
      publishedOrigin: true,
      landingSlug: true,
      name: true,
    };
    const lead = await this.prisma.lead.findUnique({
      where: { publicSiteId: siteId },
      select,
    });
    if (lead) return { kind: 'lead' as const, ...lead };
    const customer = await this.prisma.customer.findUnique({
      where: { publicSiteId: siteId },
      select,
    });
    if (customer) return { kind: 'customer' as const, ...customer };
    return null;
  }

  async findByPublishedOrigin(origin: string) {
    const select = { id: true, chatEnabled: true, publishedOrigin: true };
    const lead = await this.prisma.lead.findFirst({
      where: { publishedOrigin: origin, chatEnabled: true },
      select,
    });
    if (lead) return { kind: 'lead' as const, ...lead };
    const customer = await this.prisma.customer.findFirst({
      where: { publishedOrigin: origin, chatEnabled: true },
      select,
    });
    if (customer) return { kind: 'customer' as const, ...customer };
    return null;
  }

  async update(
    id: string,
    data: Prisma.LeadUpdateInput | Prisma.CustomerUpdateInput,
  ) {
    const kind = await this.requireKind(id);
    if (kind === 'lead') {
      return this.prisma.lead.update({
        where: { id },
        data: data as Prisma.LeadUpdateInput,
      });
    }
    return this.prisma.customer.update({
      where: { id },
      data: data as Prisma.CustomerUpdateInput,
    });
  }
}
