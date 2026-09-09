import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLATFORM_ENV_CATALOG } from './env-catalog';

export type EnvStatusItem = {
  key: string;
  group: string;
  label: string;
  required: boolean;
  present: boolean;
  ok: boolean;
  hint: string;
  value?: string;
  detail?: string;
};

export type EnvStatusPayload = {
  items: EnvStatusItem[];
  counts: {
    total: number;
    ok: number;
    missingRequired: number;
    missingOptional: number;
  };
};

@Injectable()
export class EnvStatusService {
  constructor(private readonly config: ConfigService) {}

  list(): EnvStatusPayload {
    const items = PLATFORM_ENV_CATALOG.map((entry) => {
      const present = this.present(entry.key);
      const item: EnvStatusItem = {
        key: entry.key,
        group: entry.group,
        label: entry.label,
        required: entry.required,
        present,
        ok: present,
        hint: entry.hint,
      };
      if (present && !entry.secret) {
        item.value = this.raw(entry.key);
      }
      const detail = this.detailFor(entry.key, present);
      if (detail) item.detail = detail;
      return item;
    });

    return {
      items,
      counts: {
        total: items.length,
        ok: items.filter((item) => item.present).length,
        missingRequired: items.filter((item) => item.required && !item.present)
          .length,
        missingOptional: items.filter((item) => !item.required && !item.present)
          .length,
      },
    };
  }

  private raw(key: string): string {
    if (key === 'VERCEL_TEAM_ID') {
      return (
        this.config.get<string>('VERCEL_TEAM_ID')?.trim() ||
        this.config.get<string>('VERCEL_ORG_ID')?.trim() ||
        ''
      );
    }
    return this.config.get<string>(key)?.trim() || '';
  }

  private present(key: string): boolean {
    return Boolean(this.raw(key));
  }

  private detailFor(key: string, present: boolean): string | undefined {
    if (key === 'VERCEL_TOKEN' && present) {
      const auto = this.autoDeploy();
      const team = this.present('VERCEL_TEAM_ID');
      return `deploy automático ${auto ? 'ligado' : 'desligado'}${
        team ? ' · team' : ''
      }`;
    }
    return undefined;
  }

  private autoDeploy(): boolean {
    const raw = this.config
      .get<string>('VERCEL_AUTO_DEPLOY')
      ?.trim()
      .toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    return this.present('VERCEL_TOKEN');
  }
}
