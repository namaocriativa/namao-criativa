import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerLookup } from './owner-lookup.service';
import { ownerCreateData } from './owner.util';

const LEAD_COPY_FIELDS = [
  'name',
  'category',
  'description',
  'phone',
  'whatsapp',
  'email',
  'website',
  'address',
  'city',
  'state',
  'country',
  'latitude',
  'longitude',
  'instagram',
  'facebook',
  'linkedin',
  'services',
  'rating',
  'reviewCount',
  'metadata',
  'generateConfig',
  'landingSlug',
  'landingStatus',
  'landingBuiltAt',
  'activeLandingJobId',
  'publicSiteId',
  'chatEnabled',
  'publishedOrigin',
  'vercelProjectId',
  'vercelDeploymentId',
  'fromPublicSignup',
  'createdByUserId',
  'tenantId',
  'createdAt',
] as const;

@Injectable()
export class ConvertToCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
  ) {}

  async convert(leadId: string) {
    const existing = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!existing) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      const landingSlug = existing.landingSlug;
      const publicSiteId = existing.publicSiteId;

      await tx.lead.update({
        where: { id: leadId },
        data: { landingSlug: null, publicSiteId: null },
      });

      const customerData: Prisma.CustomerUncheckedCreateInput = {
        id: existing.id,
        name: existing.name,
        category: existing.category,
        description: existing.description,
        phone: existing.phone,
        whatsapp: existing.whatsapp,
        email: existing.email,
        website: existing.website,
        address: existing.address,
        city: existing.city,
        state: existing.state,
        country: existing.country,
        latitude: existing.latitude,
        longitude: existing.longitude,
        instagram: existing.instagram,
        facebook: existing.facebook,
        linkedin: existing.linkedin,
        services: existing.services ?? Prisma.JsonNull,
        rating: existing.rating,
        reviewCount: existing.reviewCount,
        metadata: existing.metadata ?? Prisma.JsonNull,
        generateConfig: existing.generateConfig ?? Prisma.JsonNull,
        landingSlug,
        landingStatus: existing.landingStatus,
        landingBuiltAt: existing.landingBuiltAt,
        activeLandingJobId: existing.activeLandingJobId,
        publicSiteId,
        chatEnabled: existing.chatEnabled,
        publishedOrigin: existing.publishedOrigin,
        vercelProjectId: existing.vercelProjectId,
        vercelDeploymentId: existing.vercelDeploymentId,
        fromPublicSignup: existing.fromPublicSignup,
        createdByUserId: existing.createdByUserId,
        tenantId: existing.tenantId,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        convertedAt: new Date(),
      };
      void LEAD_COPY_FIELDS;

      await tx.customer.create({ data: customerData });

      const reassign = { customerId: leadId, leadId: null };
      await tx.leadImage.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.leadSource.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.clientAccount.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.invite.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.instagramConnection.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.landingJob.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.landingGeneration.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.chatSession.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.chatEvent.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.leadActivity.updateMany({
        where: { leadId },
        data: reassign,
      });
      await tx.studioLeadShare.updateMany({
        where: { leadId },
        data: reassign,
      });

      await tx.lead.delete({ where: { id: leadId } });

      await tx.leadActivity.create({
        data: {
          ...ownerCreateData('customer', leadId),
          channel: 'system',
          kind: 'converted',
          title: 'Convertido de lead',
          summary: 'O lead passou a ser Customer após o pagamento.',
        },
      });
    });

    return this.owners.requireDetail(leadId);
  }
}
