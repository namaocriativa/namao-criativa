import { Injectable, NotFoundException } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData, ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';

export type LeadActivityChannel = 'email' | 'whatsapp';

export type LeadHistoryItem = {
  id: string;
  title: string;
  summary: string | null;
  at: string;
  channel: LeadActivityChannel | 'system';
  kind: string;
};

export type RecordLeadActivityInput = {
  leadId: string;
  channel: LeadActivityChannel;
  kind: string;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class LeadActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
  ) {}

  async record(input: RecordLeadActivityInput) {
    const kind = await this.owners.requireKind(input.leadId);
    return this.prisma.leadActivity.create({
      data: {
        ...ownerCreateData(kind, input.leadId),
        channel: input.channel,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        ...(input.payload ? { payload: input.payload as object } : {}),
      },
    });
  }

  async listHistory(leadId: string) {
    const lead = await this.owners.findProfile(leadId);
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    const activities = await this.prisma.leadActivity.findMany({
      where: ownerWhere(leadId),
      orderBy: { createdAt: 'desc' },
    });

    const items: LeadHistoryItem[] = [
      ...activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        summary: activity.summary || null,
        at: activity.createdAt.toISOString(),
        channel: activity.channel as LeadActivityChannel,
        kind: activity.kind,
      })),
      ...this.systemItems(lead),
    ];

    items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return { items };
  }

  private systemItems(lead: {
    createdAt: Date;
    updatedAt: Date;
    landingBuiltAt: Date | null;
  }): LeadHistoryItem[] {
    const items: LeadHistoryItem[] = [];
    if (lead.landingBuiltAt) {
      items.push({
        id: 'system:site-built',
        title: 'Site gerado',
        summary: null,
        at: lead.landingBuiltAt.toISOString(),
        channel: 'system',
        kind: 'site-built',
      });
    }
    if (lead.updatedAt) {
      items.push({
        id: 'system:updated',
        title: 'Perfil atualizado',
        summary: null,
        at: lead.updatedAt.toISOString(),
        channel: 'system',
        kind: 'lead-updated',
      });
    }
    if (lead.createdAt) {
      items.push({
        id: 'system:created',
        title: 'Perfil criado',
        summary: null,
        at: lead.createdAt.toISOString(),
        channel: 'system',
        kind: 'lead-created',
      });
    }
    return items;
  }
}
