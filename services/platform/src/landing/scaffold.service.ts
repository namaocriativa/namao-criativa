import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { newPublicSiteId } from './public-site-id';
import { stableLandingSlug } from './prompt.builder';

const execFileAsync = promisify(execFile);

@Injectable()
export class ScaffoldService {
  private readonly logger = new Logger(ScaffoldService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
  ) {}

  getLeadsDir(): string {
    const configured = this.config.get<string>('LEADS_DIR')?.trim();
    if (configured) return path.resolve(configured);
    return path.resolve(__dirname, '..', '..', '..', '..', 'leads');
  }

  projectPath(slug: string): string {
    return path.join(this.getLeadsDir(), slug);
  }

  async resolveSlug(leadId: string) {
    const lead = await this.owners.requireDetail(leadId);
    const slug = stableLandingSlug(lead);
    const patch: { landingSlug?: string; publicSiteId?: string } = {};
    if (!lead.landingSlug) patch.landingSlug = slug;
    if (!lead.publicSiteId) patch.publicSiteId = newPublicSiteId();
    if (Object.keys(patch).length) {
      await this.owners.update(leadId, patch);
    }
    return {
      lead: {
        ...lead,
        landingSlug: lead.landingSlug || patch.landingSlug || slug,
        publicSiteId: lead.publicSiteId || patch.publicSiteId,
      },
      slug,
    };
  }

  async ensurePublicSiteId(leadId: string): Promise<string> {
    const lead = await this.owners.requireProfile(leadId);
    if (lead.publicSiteId) return lead.publicSiteId;
    const publicSiteId = newPublicSiteId();
    await this.owners.update(leadId, { publicSiteId });
    return publicSiteId;
  }

  async ensureScaffold(leadId: string) {
    const { lead, slug } = await this.resolveSlug(leadId);
    const projectDir = this.projectPath(slug);

    try {
      await fs.access(path.join(projectDir, 'package.json'));
      try {
        await fs.access(path.join(projectDir, 'vite.config.js'));
      } catch {
        await fs.writeFile(
          path.join(projectDir, 'vite.config.js'),
          `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
`,
          'utf8',
        );
      }
      if (lead.landingStatus === 'none') {
        await this.owners.update(leadId, {
          landingStatus: 'scaffolded',
          landingSlug: slug,
        });
      }
      return {
        slug,
        path: `leads/${slug}`,
        absolutePath: projectDir,
        leadId: lead.id,
        name: lead.name,
        created: false,
      };
    } catch {
      // create below
    }

    return this.createScaffold(lead, slug);
  }

  async scaffold(leadId: string) {
    return this.ensureScaffold(leadId);
  }

  private async createScaffold(
    lead: { id: string; name: string | null; publicSiteId?: string | null },
    slug: string,
  ) {
    const leadsDir = this.getLeadsDir();
    const projectDir = this.projectPath(slug);

    await fs.mkdir(leadsDir, { recursive: true });

    this.logger.log(`Creating Vite scaffold at ${projectDir}`);

    await execFileAsync(
      'npm',
      ['create', 'vite@latest', slug, '--', '--template', 'react-ts'],
      {
        cwd: leadsDir,
        env: { ...process.env, npm_config_yes: 'true' },
        timeout: 120_000,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    await fs.mkdir(path.join(projectDir, 'public', 'images'), {
      recursive: true,
    });

    const gitignore = `node_modules
dist
.DS_Store
*.local
.vercel
.landing-pipeline
`;
    await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore, 'utf8');

    const readme = `# ${lead.name || slug}

Projeto Vite independente gerado a partir do enrichment.

## Dev

\`\`\`bash
cd leads/${slug}
npm install
npm run dev
\`\`\`

## Deploy Vercel

O server publica o \`dist/\` automaticamente depois do build quando \`VERCEL_TOKEN\` está no \`.env\`.
Também dá para republicar pelo botão **Publicar na Vercel** na página do lead.
`;
    await fs.writeFile(path.join(projectDir, 'README.md'), readme, 'utf8');

    await fs.writeFile(
      path.join(projectDir, '.scaffold-ok'),
      new Date().toISOString(),
      'utf8',
    );

    await fs.writeFile(
      path.join(projectDir, 'vite.config.js'),
      `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
});
`,
      'utf8',
    );

    await this.owners.update(lead.id, {
      landingSlug: slug,
      landingStatus: 'scaffolded',
      publicSiteId: lead.publicSiteId || newPublicSiteId(),
    });

    return {
      slug,
      path: `leads/${slug}`,
      absolutePath: projectDir,
      leadId: lead.id,
      name: lead.name,
      created: true,
    };
  }

  async assertScaffoldExists(slug: string) {
    const projectDir = this.projectPath(slug);
    try {
      await fs.access(path.join(projectDir, 'package.json'));
    } catch {
      throw new NotFoundException(
        `Scaffold não encontrado em leads/${slug}. Gere o scaffold primeiro.`,
      );
    }
    return projectDir;
  }
}
