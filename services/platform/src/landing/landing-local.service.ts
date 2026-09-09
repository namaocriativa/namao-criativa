import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'net';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ScaffoldService } from './scaffold.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { stableLandingSlug } from './prompt.builder';

const BASE_PORT = 4173;
const MAX_PORT = 4199;
const READY_MS = 25_000;

type LocalSession = {
  leadId: string;
  slug: string;
  port: number;
  url: string;
  child: ChildProcess;
};

@Injectable()
export class LandingLocalService implements OnModuleDestroy {
  private readonly logger = new Logger(LandingLocalService.name);
  private readonly sessions = new Map<string, LocalSession>();

  constructor(
    private readonly owners: OwnerLookup,
    private readonly scaffoldService: ScaffoldService,
  ) {}

  async start(leadId: string) {
    const current = this.sessions.get(leadId);
    if (current && current.child.exitCode == null) {
      return { url: current.url, port: current.port, reused: true };
    }
    if (current) this.sessions.delete(leadId);

    const lead = await this.owners.requireDetail(leadId);
    const slug = (lead.landingSlug || stableLandingSlug(lead)).trim();
    if (!slug) {
      throw new NotFoundException('Lead sem landing gerada');
    }
    const projectDir = this.scaffoldService.projectPath(slug);
    await this.assertPreviewReady(projectDir);

    const port = await this.findFreePort();
    const url = `http://127.0.0.1:${port}/`;
    const bin = viteBin(projectDir);
    const child = spawn(
      bin,
      ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      {
        cwd: projectDir,
        env: { ...process.env, BROWSER: 'none' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const session: LocalSession = { leadId, slug, port, url, child };
    this.sessions.set(leadId, session);

    try {
      await waitForReady(child, port, READY_MS);
    } catch (error) {
      this.stopLead(leadId);
      throw error;
    }

    child.on('exit', (code) => {
      const active = this.sessions.get(leadId);
      if (active?.child === child) this.sessions.delete(leadId);
      this.logger.log(`Preview local ${slug} encerrou (code ${code})`);
    });

    this.logger.log(`Preview local ${slug} em ${url}`);
    return { url, port, reused: false };
  }

  stopLead(leadId: string) {
    const session = this.sessions.get(leadId);
    if (!session) return false;
    this.sessions.delete(leadId);
    killProcess(session.child);
    return true;
  }

  onModuleDestroy() {
    for (const leadId of [...this.sessions.keys()]) {
      this.stopLead(leadId);
    }
  }

  private async assertPreviewReady(projectDir: string) {
    try {
      await fs.access(path.join(projectDir, 'dist', 'index.html'));
      await fs.access(viteBin(projectDir));
    } catch {
      throw new NotFoundException(
        'Site local indisponível. Gere o site e aguarde o build.',
      );
    }
  }

  private async findFreePort(): Promise<number> {
    const used = new Set(
      [...this.sessions.values()].map((session) => session.port),
    );
    for (let port = BASE_PORT; port <= MAX_PORT; port += 1) {
      if (used.has(port)) continue;
      if (await canListen(port)) return port;
    }
    throw new BadRequestException('Nenhuma porta livre entre 4173 e 4199');
  }
}

function viteBin(projectDir: string): string {
  const name = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  return path.join(projectDir, 'node_modules', '.bin', name);
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function waitForReady(
  child: ChildProcess,
  port: number,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new BadRequestException(
          `Timeout ao iniciar o site local na porta ${port}. ${chunks.join('').trim()}`,
        ),
      );
    }, timeoutMs);

    const onData = (buf: Buffer) => {
      const text = buf.toString();
      chunks.push(text);
      if (
        text.includes(`http://127.0.0.1:${port}`) ||
        text.includes(`localhost:${port}`)
      ) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(
        new BadRequestException(
          `O preview local encerrou (code ${code}). ${chunks.join('').trim()}`,
        ),
      );
    };

    function cleanup() {
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
    }

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
  });
}

function killProcess(child: ChildProcess) {
  if (child.exitCode != null || child.killed) return;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode == null && !child.killed) child.kill('SIGKILL');
  }, 1500).unref();
}
