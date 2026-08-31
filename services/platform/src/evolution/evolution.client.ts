import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type EvolutionSendResult =
  | { skipped: true; reason: string }
  | { skipped: false; ok: true; data: unknown }
  | { skipped: false; ok: false; error: string };

@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);

  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(
      this.config.get<string>('EVOLUTION_API_URL')?.trim() &&
        this.config.get<string>('EVOLUTION_API_KEY')?.trim() &&
        this.config.get<string>('EVOLUTION_INSTANCE')?.trim(),
    );
  }

  async sendText(opts: {
    phone: string;
    text: string;
  }): Promise<EvolutionSendResult> {
    const base = this.config.get<string>('EVOLUTION_API_URL')?.replace(/\/$/, '');
    const key = this.config.get<string>('EVOLUTION_API_KEY')?.trim();
    const instance = this.config.get<string>('EVOLUTION_INSTANCE')?.trim();

    if (!base || !key || !instance) {
      return {
        skipped: true,
        reason: 'not_configured',
      };
    }

    try {
      const number = opts.phone.replace(/\D/g, '');
      const res = await axios.post(
        `${base}/message/sendText/${encodeURIComponent(instance)}`,
        {
          number,
          text: opts.text,
        },
        {
          headers: { apikey: key },
          timeout: 15000,
        },
      );
      return { skipped: false, ok: true, data: res.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Evolution sendText skipped/failed: ${message}`);
      return { skipped: false, ok: false, error: message };
    }
  }
}
