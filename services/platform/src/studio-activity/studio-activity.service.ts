import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RecordStudioActivityInput = {
  userId: string;
  method: string;
  path: string;
  kind: string;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class StudioActivityService {
  private readonly logger = new Logger(StudioActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordStudioActivityInput) {
    try {
      await this.prisma.studioUserActivity.create({
        data: {
          userId: input.userId,
          method: input.method,
          path: input.path,
          kind: input.kind,
          title: input.title,
          summary: input.summary,
          ...(input.payload ? { payload: input.payload as object } : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar atividade: ${error instanceof Error ? error.message : 'erro'}`,
      );
    }
  }

  recordLogin(userId: string) {
    return this.record({
      userId,
      method: 'POST',
      path: '/auth/studio/login',
      kind: 'auth.login',
      title: 'Entrou no studio',
      summary: 'Login no studio',
    });
  }

  recordLogout(userId: string) {
    return this.record({
      userId,
      method: 'POST',
      path: '/auth/studio/logout',
      kind: 'auth.logout',
      title: 'Saiu do studio',
      summary: 'Logout do studio',
    });
  }
}
