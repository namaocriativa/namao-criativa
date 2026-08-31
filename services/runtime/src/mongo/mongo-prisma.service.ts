import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/mongo';

@Injectable()
export class MongoPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoPrismaService.name);
  private client: PrismaClient | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('MONGODB_URL')?.trim());
  }

  async onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn('MONGODB_URL not set; invite requests disabled');
      return;
    }

    const client = new PrismaClient();
    try {
      await client.$connect();
      this.client = client;
      this.logger.log('MongoDB connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`MongoDB unavailable: ${message}`);
      await client.$disconnect().catch(() => undefined);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect().catch(() => undefined);
      this.client = null;
    }
  }

  get prisma(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Pedidos de convite indisponíveis. Configure MONGODB_URL.',
      );
    }
    return this.client;
  }
}
