import { Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordLeadActivityInput) {
    return this.prisma.leadActivity.create({
      data: {
        leadId: input.leadId,
        channel: input.channel,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        ...(input.payload ? { payload: input.payload as object } : {}),
      },
    });
  }

  async listHistory(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        landingBuiltAt: true,
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    const activities = await this.prisma.leadActivity.findMany({
      where: { leadId },
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
        title: 'Lead atualizado',
        summary: null,
        at: lead.updatedAt.toISOString(),
        channel: 'system',
        kind: 'lead-updated',
      });
    }
    if (lead.createdAt) {
      items.push({
        id: 'system:created',
        title: 'Lead criado',
        summary: null,
        at: lead.createdAt.toISOString(),
        channel: 'system',
        kind: 'lead-created',
      });
    }
    return items;
  }
}
