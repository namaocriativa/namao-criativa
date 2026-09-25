import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtUser } from '../auth/jwt.strategy';
import { ConvertToCustomerService } from '../owner/convert-to-customer.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { jwtOwnerId, ownerCreateData, ownerWhere } from '../owner/owner.util';
import { PackagesService } from '../packages/packages.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_STATUS, PROPOSAL_STATUS } from './proposal.constants';
import { presentProposal } from './proposal.view';
import {
  parseSnapshot,
  snapshotAmount,
  snapshotPackage,
  type PackageSnapshot,
} from './proposal.snapshot';

@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
    private readonly packages: PackagesService,
    private readonly convert: ConvertToCustomerService,
  ) {}

  async upsertFromSend(ownerId: string, packageId: string) {
    const kind = await this.owners.requireKind(ownerId);
    const pkg = await this.packages.requireActive(packageId);
    const snapshot = snapshotPackage(pkg);
    const existing = await this.findRow(ownerId);
    if (existing?.status === PROPOSAL_STATUS.ACCEPTED) {
      return existing;
    }
    const paymentStatus = this.initialPaymentStatus(snapshot, true);
    if (existing) {
      return this.prisma.proposal.update({
        where: { id: existing.id },
        data: {
          packageId: pkg.id,
          packageSnapshot: snapshot,
          collectPayment: true,
          paymentStatus,
        },
      });
    }
    const owner = await this.requireTenantOwner(ownerId);
    return this.prisma.proposal.create({
      data: {
        tenantId: owner.tenantId,
        ...ownerCreateData(kind, ownerId),
        packageId: pkg.id,
        packageSnapshot: snapshot,
        status: PROPOSAL_STATUS.PENDING,
        paymentStatus,
        collectPayment: true,
      },
    });
  }

  async getForOwner(ownerId: string) {
    await this.owners.requireKind(ownerId);
    const row = await this.findRow(ownerId);
    if (!row) return { proposal: null };
    return { proposal: await presentProposal(row, this.config) };
  }

  async getForClient(user: JwtUser) {
    const ownerId = this.requireClientOwner(user);
    const row = await this.findRow(ownerId);
    if (!row) return { proposal: null };
    return { proposal: await presentProposal(row, this.config) };
  }

  async accept(user: JwtUser) {
    const ownerId = this.requireClientOwner(user);
    const existing = await this.findRow(ownerId);
    if (!existing) {
      throw new NotFoundException('Nenhuma proposta encontrada para esta conta.');
    }
    if (existing.status !== PROPOSAL_STATUS.ACCEPTED) {
      const kind = await this.owners.kindOf(ownerId);
      if (kind === 'lead') {
        await this.convert.convert(ownerId);
      }
      const snapshot = parseSnapshot(existing.packageSnapshot);
      const paymentStatus = existing.collectPayment && snapshotAmount(snapshot)
        ? PAYMENT_STATUS.PENDING
        : PAYMENT_STATUS.WAIVED;
      const now = new Date();
      await this.prisma.proposal.update({
        where: { id: existing.id },
        data: {
          status: PROPOSAL_STATUS.ACCEPTED,
          paymentStatus:
            existing.paymentStatus === PAYMENT_STATUS.PAID
              ? PAYMENT_STATUS.PAID
              : paymentStatus,
          acceptedAt: now,
        },
      });
      await this.prisma.leadActivity.create({
        data: {
          ...ownerCreateData('customer', ownerId),
          channel: 'system',
          kind: 'proposal.accepted',
          title: 'Proposta aceita',
          summary: 'O cliente aceitou a proposta e passou a ser customer.',
        },
      });
    }
    const row = await this.findRow(ownerId);
    if (!row) {
      throw new NotFoundException('Nenhuma proposta encontrada para esta conta.');
    }
    return { proposal: await presentProposal(row, this.config) };
  }

  async markPaid(ownerId: string) {
    await this.owners.requireKind(ownerId);
    const existing = await this.findRow(ownerId);
    if (!existing) {
      throw new NotFoundException('Nenhuma proposta encontrada para este perfil.');
    }
    const row = await this.prisma.proposal.update({
      where: { id: existing.id },
      data: {
        paymentStatus: PAYMENT_STATUS.PAID,
        paidAt: existing.paidAt || new Date(),
      },
    });
    const kind = await this.owners.requireKind(ownerId);
    await this.prisma.leadActivity.create({
      data: {
        ...ownerCreateData(kind, ownerId),
        channel: 'system',
        kind: 'proposal.paid',
        title: 'Pagamento marcado',
        summary: 'Pagamento da proposta marcado como pago no Studio.',
      },
    });
    return { proposal: await presentProposal(row, this.config) };
  }

  private requireClientOwner(user: JwtUser): string {
    const ownerId = jwtOwnerId(user);
    if (!ownerId) {
      throw new BadRequestException('Conta sem lead ou cliente vinculado.');
    }
    return ownerId;
  }

  private async findRow(ownerId: string) {
    return this.prisma.proposal.findFirst({
      where: ownerWhere(ownerId),
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireTenantOwner(ownerId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: ownerId },
      select: { tenantId: true },
    });
    if (lead) return lead;
    const customer = await this.prisma.customer.findUnique({
      where: { id: ownerId },
      select: { tenantId: true },
    });
    if (customer) return customer;
    throw new NotFoundException(`Perfil ${ownerId} não encontrado`);
  }

  private initialPaymentStatus(snapshot: PackageSnapshot, collectPayment: boolean) {
    if (!collectPayment || !snapshotAmount(snapshot)) return PAYMENT_STATUS.WAIVED;
    return PAYMENT_STATUS.PENDING;
  }

}

