import { Injectable, Logger } from '@nestjs/common';
import {
  type Architecture,
  type ComponentId,
  type CreativeDirection,
  type PageSpec,
  type SectionSpec,
  componentSupportsVideo,
  grammarViolations,
  heuristicStyle,
  isDeterministicComponent,
  parseCreativeDirection,
  parseCopywriterResult,
  parsePageSpec,
  parseVisualReview,
  recipeForStyle,
  resolveTheme,
  colorStrategyForTheme,
  isChatRuntimeFeature,
  AI_CHAT_FEATURE_ID,
  AI_CONCIERGE_FEATURE_ID,
  fillMapFeatureProps,
} from '@namao/landing-kit';
import { publicChatApiOrigin } from './public-chat-origin';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { LandingJobRuntime, LandingJobsService } from './landing-jobs.service';
import { applyCopywriterOverride, buildLeadBrief } from './lead-brief';
import { LlmService } from '../llm/llm.service';
import { StorageService } from '../storage/storage.service';
import { assembleLandingFiles, isAllowedHref, parseVisionAnalysis } from './pipeline-assembler';
import { analyzePipelineIntent } from './pipeline-intent';
import {
  buildArtDirectorPrompt,
  buildCopywriterPrompt,
  buildPageArchitectPrompt,
  buildPexelsPickPrompt,
  buildPexelsQueryPrompt,
  buildVisionPrompt,
  buildVisualReviewPrompt,
} from './pipeline-prompts';
import type {
  BriefVideo,
  LandingFeature,
  LandingSectionConfig,
  LeadBrief,
  VisionAnalysis,
} from './pipeline.types';
import { normalizeGenerateConfig } from './generate-config';
import {
  fallbackPexelsPick,
  heuristicPexelsQuery,
  heroStockVideoRequested,
  parsePexelsPick,
  parsePexelsQuery,
  type PexelsCandidate,
} from './pexels-select';
import { PexelsService } from './pexels.service';
import { findInventedContacts } from './pipeline-validator';
import { ScaffoldService } from './scaffold.service';
import { ScreenshotService } from './screenshot.service';
import { VercelService } from './vercel.service';
import {
  applyAssignedMedia,
  applyPropPatch,
  applySwap,
  fillDeterministicProps,
  grammarBriefFromLead,
  navFromSections,
  primaryCtaFromBrief,
  resolveArchitecture,
  sanitizeProps,
  validatePageSpecAgainstBrief,
} from './spec-fill';

const execFileAsync = promisify(execFile);
const PREVIEW_CHARS = 80;
const MAX_VISUAL_PASSES = 2;
const VISUAL_SCORE_THRESHOLD = 75;

class JobCancelledError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} cancelado`);
    this.name = 'JobCancelledError';
  }
}

@Injectable()
export class LandingPipelineService {
  private readonly logger = new Logger(LandingPipelineService.name);

  constructor(
    private readonly owners: OwnerLookup,
    private readonly scaffoldService: ScaffoldService,
    private readonly llmService: LlmService,
    private readonly jobsService: LandingJobsService,
    private readonly screenshotService: ScreenshotService,
    private readonly prisma: PrismaService,
    private readonly vercelService: VercelService,
    private readonly pexels: PexelsService,
    private readonly storage: StorageService,
  ) {}

  async run(job: LandingJobRuntime) {
    try {
      await this.execute(job);
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await this.jobsService.emit(job, {
          stage: 'cancelled',
          message: error.message,
          slug: job.slug,
        });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.jobsService.emit(job, {
        stage: 'error',
        message,
        error: message,
        slug: job.slug,
      });
    }
  }

  private async execute(job: LandingJobRuntime) {
    const warnings: string[] = [];
    const lead = await this.owners.requireDetail(job.leadId);
    const publicSiteId = await this.scaffoldService.ensurePublicSiteId(lead.id);
    const apiBase = publicChatApiOrigin();
    const projectDir = await this.scaffoldService.assertScaffoldExists(job.slug);
    const artifactDir = path.join(projectDir, '.landing-pipeline');
    await fs.mkdir(path.join(artifactDir, 'sections'), { recursive: true });

    const emitProgress = async (
      stage: LandingJobRuntime['status'],
      message: string,
      extra: { step?: number; totalSteps?: number; sectionId?: string } = {},
    ) => {
      await this.throwIfCancelled(job);
      await this.jobsService.emit(job, {
        stage,
        message,
        slug: job.slug,
        ...extra,
      });
    };

    const onChunk =
      (stage: LandingJobRuntime['status'], label: string, extra = {}) =>
      (_piece: string, full: string) => {
        if (full.length % 800 < 40) {
          void this.jobsService.emit(job, {
            stage,
            message: `${label} (${full.length} chars)`,
            tokens: full.length,
            slug: job.slug,
            ...extra,
          });
        }
      };

    const config = normalizeGenerateConfig(job.config);
    job.config = config;
    const sectionCount = Math.max(config.sections.length, 1);
    const totalSteps = 13 + sectionCount;

    await emitProgress('briefing', 'Montando brief factual...', {
      step: 1,
      totalSteps,
    });
    const briefBase = applyCopywriterOverride(
      buildLeadBrief(lead),
      config.copywriter,
    );
    let brief = await this.mergeStoredVideos(lead.id, briefBase);
    if (config.copywriter) {
      const filled = [
        config.copywriter.category ? 'categoria' : '',
        config.copywriter.services?.length ? 'serviços' : '',
        config.copywriter.description ? 'descrição' : '',
        config.copywriter.address ? 'endereço' : '',
        config.copywriter.notes ? 'notas' : '',
      ].filter(Boolean);
      if (filled.length) {
        await emitProgress(
          'briefing',
          `Brief + fatos do wizard (${filled.join(', ')})`,
          { step: 1, totalSteps },
        );
      }
    }
    await writeJson(path.join(artifactDir, 'brief.json'), brief);
    await writeJson(path.join(artifactDir, 'generator-config.json'), config);

    let vision: VisionAnalysis | null = null;
    const visionPaths = await this.resolveVisionImagePaths(lead.id, brief);
    if (!visionPaths.length) {
      await emitProgress('vision', 'pulado: sem imagens para análise visual', {
        step: 2,
        totalSteps,
      });
    } else {
      const visionModel = `${this.llmService.providerFor('vision')}:${this.llmService.modelFor('vision')}`;
      await emitProgress('vision', `Analisando imagens (${visionModel})...`, {
        step: 2,
        totalSteps,
      });
      try {
        vision = await this.llmService.generateVisionJson(
          buildVisionPrompt(brief),
          visionPaths,
          parseVisionAnalysis,
          {
            temperature: 0.2,
            expectedShape: 'VisionAnalysis',
            role: 'vision',
            keepAlive: 0,
            onChunk: onChunk('vision', 'Visão'),
          },
        );
        await writeJson(path.join(artifactDir, 'vision.json'), vision);
        await this.llmService.unload('vision');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`visão ignorada: ${msg}`);
        this.logger.warn(msg);
        await this.llmService.unload('vision');
      }
    }

    const intent = analyzePipelineIntent({
      brief,
      sections: config.sections,
      vision,
      imageCount: visionPaths.length,
    });
    await writeJson(path.join(artifactDir, 'intent.json'), intent);

    let grammar = grammarBriefFromLead(
      brief,
      config.sections.map((item) => item.type),
    );
    const planModelName = this.llmService.modelFor('plan');
    const planModel = `${this.llmService.providerFor('plan')}:${planModelName}`;

    let direction: CreativeDirection;
    if (intent.useHeuristicDesign) {
      direction = heuristicDirection(brief);
      await emitProgress(
        'art_director',
        `pulado: direção heurística ${direction.style}`,
        { step: 3, totalSteps },
      );
    } else {
      await emitProgress(
        'art_director',
        `Art Director (${planModel})...`,
        { step: 3, totalSteps },
      );
      try {
        direction = await this.llmService.generateJson(
          buildArtDirectorPrompt(brief, vision, config.sections, config.theme),
          (value) => parseDirection(value, brief),
          {
            temperature: 0.2,
            expectedShape: 'CreativeDirection',
            role: 'plan',
            model: planModelName,
            onChunk: onChunk('art_director', 'Art Director'),
          },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`art director fallback: ${msg}`);
        direction = heuristicDirection(brief);
      }
    }
    if (config.theme) {
      direction = {
        ...direction,
        colorStrategy: colorStrategyForTheme(config.theme),
      };
    }
    await writeJson(path.join(artifactDir, 'creative-direction.json'), direction);

    const wantsStockVideo = heroStockVideoRequested(config.sections);
    const heroLock = config.sections.find((item) => item.type === 'hero')?.component;
    const optimisticVideo =
      wantsStockVideo &&
      (!heroLock || componentSupportsVideo(heroLock));

    const architectGrammar = {
      ...grammar,
      hasVideo: grammar.hasVideo || optimisticVideo,
      imageStrategy: direction.imageStrategy,
      runtime: intent.complexity === 'rich' ? ('premium' as const) : ('lite' as const),
    };

    await emitProgress(
      'page_architect',
      `Page Architect (${planModel})...`,
      { step: 4, totalSteps },
    );
    let architecture: Architecture;
    const needsArchitect = config.sections.some((section) => !section.component);
    if (!needsArchitect) {
      architecture = resolveArchitecture({}, config.sections, architectGrammar);
    } else {
      try {
        architecture = await this.llmService.generateJson(
          buildPageArchitectPrompt({
            brief,
            direction,
            lockedSections: config.sections,
            grammar: architectGrammar,
            features: config.features,
            theme: config.theme,
          }),
          (value) => resolveArchitecture(value, config.sections, architectGrammar),
          {
            temperature: 0.1,
            expectedShape: 'Architecture',
            role: 'plan',
            model: planModelName,
            keepAlive: 0,
            onChunk: onChunk('page_architect', 'Arquiteto'),
          },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`architect fallback: ${msg}`);
        architecture = resolveArchitecture({}, config.sections, architectGrammar);
      }
    }
    await writeJson(path.join(artifactDir, 'architecture.json'), architecture);

    if (wantsStockVideo) {
      await emitProgress('pexels', 'Vídeo Pexels do nicho...', {
        step: 5,
        totalSteps,
      });
      brief = await this.resolveStockVideo({
        job,
        brief,
        architecture,
        configSections: config.sections,
        vision,
        artifactDir,
        planModelName,
        onChunk,
        warnings,
      });
      brief = await this.mergeStoredVideos(lead.id, brief);
      grammar = {
        ...grammar,
        hasVideo: Boolean(brief.videos?.length),
      };
      await writeJson(path.join(artifactDir, 'brief.json'), brief);
    } else {
      await emitProgress('pexels', 'pulado: sem pedido de vídeo Pexels', {
        step: 5,
        totalSteps,
      });
    }
    await this.llmService.unload('plan');

    const recipe = recipeForStyle(direction.style);
    const theme = resolveTheme({
      style: direction.style,
      visualLanguage: direction.visualLanguage,
      colorStrategy: direction.colorStrategy,
      imageStrategy: direction.imageStrategy,
      density: direction.density,
      radius: direction.radius || recipe.radius,
      spacing: direction.spacing || recipe.spacing,
      paletteId: recipe.paletteId,
      fontPairId: recipe.fontPairId,
      colors: config.theme?.colors,
    });

    const nav = navFromSections(architecture.sections.map((item, index) => ({
      id: item.id,
      type: item.type,
      title: config.sections[index]?.title || item.id,
    })));
    const primaryCta = direction.primaryCta || primaryCtaFromBrief(brief);
    const codeModelName = this.llmService.modelFor('code');
    const codeModel = `${this.llmService.providerFor('code')}:${codeModelName}`;

    const sectionSpecs: SectionSpec[] = [];
    const llmIndexes = architecture.sections
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !isDeterministicComponent(item.component));
    const lastLlmIndex = llmIndexes.length
      ? llmIndexes[llmIndexes.length - 1].index
      : -1;

    const fillOne = async (
      sectionConfig: LandingSectionConfig,
      component: ComponentId,
      purpose: string,
      issuesToFix: string[] | undefined,
      keepAlive: number | undefined,
    ): Promise<SectionSpec> => {
      const deterministic = fillDeterministicProps(component, brief, {
        nav,
        primaryCta,
        title: sectionConfig.title,
      });
      if (deterministic) {
        return {
          id: sectionConfig.id,
          type: sectionConfig.type,
          component,
          purpose,
          props: sanitizeProps(
            component,
            applyAssignedMedia(component, deterministic, sectionConfig.media),
            brief,
          ),
        };
      }

      const run = (fix: string[] | undefined, alive: number | undefined) =>
        this.llmService.generateJson(
          buildCopywriterPrompt({
            brief,
            sectionId: sectionConfig.id,
            sectionConfig,
            component,
            direction,
            theme,
            previous: sectionSpecs
              .filter((item) => item.id !== sectionConfig.id)
              .map((item) => ({
                id: item.id,
                preview: JSON.stringify(item.props).slice(0, PREVIEW_CHARS),
              })),
            issuesToFix: fix,
            vision,
          }),
          (value) => parseCopywriterResult(value, sectionConfig.id),
          {
            temperature: 0.35,
            expectedShape: `Copywriter:${sectionConfig.id}`,
            role: 'code',
            model: codeModelName,
            keepAlive: alive,
            onChunk: onChunk('copywriter', `Copy ${sectionConfig.id}`, {
              sectionId: sectionConfig.id,
            }),
          },
        );

      let parsed = await run(issuesToFix, undefined);
      let props: Record<string, unknown>;
      try {
        props = sanitizeCopy(component, parsed.props, brief);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`seção ${sectionConfig.id}: props inválidas, fallback (${msg})`);
        props = sanitizeProps(component, {}, brief);
      }
      let issues = validatePropsBlob(props, brief);
      if (issues.length) {
        const retried = await run(
          [...(issuesToFix || []), ...issues],
          keepAlive,
        );
        try {
          const retryProps = sanitizeCopy(component, retried.props, brief);
          const retryIssues = validatePropsBlob(retryProps, brief);
          if (retryIssues.length <= issues.length) {
            props = retryProps;
            issues = retryIssues;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          warnings.push(`seção ${sectionConfig.id}: retry inválido (${msg})`);
        }
        if (issues.length) {
          warnings.push(
            ...issues.map((issue) => `seção ${sectionConfig.id}: ${issue}`),
          );
        }
      } else if (keepAlive === 0) {
        await this.llmService.unload('code');
      }

      return {
        id: sectionConfig.id,
        type: sectionConfig.type,
        component,
        purpose,
        props: sanitizeProps(
          component,
          applyAssignedMedia(component, props, sectionConfig.media),
          brief,
        ),
      };
    };

    for (let i = 0; i < architecture.sections.length; i += 1) {
      await this.throwIfCancelled(job);
      const arch = architecture.sections[i];
      const sectionConfig =
        config.sections.find((item) => item.id === arch.id) || {
          id: arch.id,
          type: arch.type,
          title: arch.id,
          description: '',
        };
      const deterministic = isDeterministicComponent(arch.component);
      await emitProgress(
        'copywriter',
        deterministic
          ? `Preenchendo ${sectionConfig.title} (${arch.component}) sem modelo...`
          : `Copywriter ${sectionConfig.title} → ${arch.component} (${codeModel}, ${i + 1}/${sectionCount})...`,
        { step: 6 + i, totalSteps, sectionId: arch.id },
      );
      const filled = await fillOne(
        sectionConfig,
        arch.component,
        arch.purpose,
        undefined,
        i === lastLlmIndex ? 0 : undefined,
      );
      sectionSpecs.push(filled);
      await writeJson(
        path.join(artifactDir, 'sections', `${filled.id}.json`),
        filled,
      );
    }
    await this.llmService.unload('code');

    const afterSections = 5 + sectionCount;
    let spec = parsePageSpec({
      version: 1,
      theme: {
        style: theme.style,
        visualLanguage: theme.visualLanguage,
        colorStrategy: theme.colorStrategy,
        imageStrategy: theme.imageStrategy,
        density: theme.density,
        radius: theme.radius,
        spacing: theme.spacing,
        paletteId: theme.paletteId,
        fontPairId: theme.fontPairId,
      },
      sections: sectionSpecs,
      overlays: config.components.map((item) => ({
        component: item.component,
        html: item.html,
        css: item.css,
        js: item.js,
        props: item.props,
      })),
      features: fillMapFeatureProps(
        withChatFeatureProps(config.features, brief),
        brief,
        config.sections,
      ),
    });

    const grammarIssues = grammarViolations(spec, grammar);
    if (grammarIssues.length) {
      warnings.push(...grammarIssues.map((issue) => `grammar: ${issue}`));
    }

    await emitProgress('validating', 'Validando Page Spec (Zod + brief)...', {
      step: afterSections + 1,
      totalSteps,
    });
    const factIssues = validatePageSpecAgainstBrief(spec, brief);
    if (factIssues.length) {
      warnings.push(...factIssues.map((issue) => `validação: ${issue}`));
    }

    await emitProgress('saving', 'Escrevendo page-spec e scaffold React...', {
      step: afterSections + 2,
      totalSteps,
    });
    await this.writeProject(projectDir, brief, spec, { publicSiteId, apiBase });
    await writeJson(path.join(artifactDir, 'page-spec.json'), spec);
    await this.owners.update(lead.id, {
      chatEnabled: spec.features.some((item) => isChatRuntimeFeature(item.id)),
    });

    await emitProgress('copying_images', 'Copiando imagens do enrichment...');
    const copied = await this.copyImages(lead.id, projectDir);
    await emitProgress('copying_images', `${copied} imagem(ns) copiada(s)`);
    const copiedVideos = await this.copyVideos(lead.id, projectDir);
    if (copiedVideos) {
      await emitProgress(
        'copying_images',
        `${copiedVideos} vídeo(s) copiado(s)`,
      );
    }

    await this.throwIfCancelled(job);
    await emitProgress('npm_install', 'npm install...');
    try {
      await execFileAsync('npm', ['install'], {
        cwd: projectDir,
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`npm install falhou: ${detail}`);
    }

    await this.throwIfCancelled(job);
    await emitProgress('npm_build', 'npm run build...');
    try {
      await execFileAsync('npm', ['run', 'build'], {
        cwd: projectDir,
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`npm run build falhou: ${detail}`);
    }

    let visualScore: number | null = null;
    let screenshotRel: string | null = null;

    if (intent.skipReview) {
      await emitProgress(
        'visual_review',
        'pulado: brief simples, sem crítico visual',
        { step: afterSections + 3, totalSteps },
      );
    } else {
      for (let pass = 1; pass <= MAX_VISUAL_PASSES; pass += 1) {
        await emitProgress(
          'screenshot',
          `Capturando screenshot (pass ${pass})...`,
          { step: afterSections + 3, totalSteps },
        );
        const shotPath = path.join(artifactDir, `screenshot-${pass}.jpg`);
        const captured = await this.screenshotService.capturePage(
          path.join(projectDir, 'dist', 'index.html'),
          shotPath,
        );
        if (!captured) {
          warnings.push('screenshot/crítico visual pulado: Playwright indisponível');
          break;
        }
        screenshotRel = path.relative(projectDir, captured);

        await emitProgress(
          'visual_review',
          `Crítico visual (${this.llmService.providerFor('vision')}:${this.llmService.modelFor('vision')})...`,
          { step: afterSections + 4, totalSteps },
        );
        try {
          const review = await this.llmService.generateVisionJson(
            buildVisualReviewPrompt({
              components: spec.sections.map((item) => item.component),
              style: spec.theme.style,
            }),
            [captured],
            parseVisualReview,
            {
              temperature: 0.1,
              expectedShape: 'VisualReview',
              role: 'vision',
              keepAlive: 0,
            },
          );
          await writeJson(
            path.join(artifactDir, `visual-review-${pass}.json`),
            review,
          );
          visualScore = review.score;
          if (review.score >= VISUAL_SCORE_THRESHOLD || pass === MAX_VISUAL_PASSES) {
            if (review.score < VISUAL_SCORE_THRESHOLD) {
              warnings.push(
                ...review.issues.map(
                  (issue) =>
                    `visual: ${issue.sectionId || '?'} ${issue.problem}`,
                ),
              );
            }
            break;
          }

          let next = spec;
          for (const issue of review.issues) {
            if (!issue.suggestion || !issue.sectionId) continue;
            if (
              issue.suggestion.kind === 'swap-component' &&
              issue.suggestion.component
            ) {
              next = applySwap(
                next,
                issue.sectionId,
                issue.suggestion.component,
                grammar,
              );
            } else if (
              issue.suggestion.kind === 'adjust-props' &&
              issue.suggestion.props
            ) {
              next = applyPropPatch(
                next,
                issue.sectionId,
                issue.suggestion.props,
                brief,
              );
            }
          }
          const nextGrammar = grammarViolations(next, grammar);
          const nextFacts = validatePageSpecAgainstBrief(next, brief);
          if (nextGrammar.length || nextFacts.length) {
            warnings.push('improve descartado: violou grammar/brief');
            break;
          }
          spec = parsePageSpec(next);
          await this.writeProject(projectDir, brief, spec, { publicSiteId, apiBase });
          await writeJson(path.join(artifactDir, 'page-spec.json'), spec);
          await emitProgress('npm_build', 'Rebuild após crítico visual...');
          await execFileAsync('npm', ['run', 'build'], {
            cwd: projectDir,
            timeout: 180_000,
            maxBuffer: 10 * 1024 * 1024,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          warnings.push(`crítico visual ignorado: ${msg}`);
          break;
        }
      }
    }

    try {
      await this.prisma.landingGeneration.upsert({
        where: { jobId: job.id },
        create: {
          ...ownerCreateData(
            await this.owners.requireKind(job.leadId),
            job.leadId,
          ),
          jobId: job.id,
          pageSpec: spec as object,
          componentIds: spec.sections.map((item) => item.component).join(','),
          themeStyle: spec.theme.style,
          category: brief.category,
          visualScore,
          screenshotPath: screenshotRel,
        },
        update: {
          pageSpec: spec as object,
          componentIds: spec.sections.map((item) => item.component).join(','),
          themeStyle: spec.theme.style,
          category: brief.category,
          visualScore,
          screenshotPath: screenshotRel,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`benchmark não persistido: ${msg}`);
    }

    let publishedUrl = '';
    if (this.vercelService.autoDeploy) {
      await emitProgress('publishing', 'Publicando na Vercel...');
      try {
        const published = await this.vercelService.publishProject({
          leadId: job.leadId,
          slug: job.slug,
          projectDir,
          existingProjectId: lead.vercelProjectId,
        });
        publishedUrl = published.url;
        await emitProgress('publishing', `Publicado em ${published.url}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`Vercel: ${msg}`);
      }
    }

    const stage = warnings.length ? 'done_with_warnings' : 'done';
    await this.jobsService.emit(job, {
      stage,
      message: [
        warnings.length
          ? `Landing salva em leads/${job.slug} (com avisos)`
          : `Landing salva em leads/${job.slug}`,
        publishedUrl ? `Vercel: ${publishedUrl}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      slug: job.slug,
      path: `leads/${job.slug}`,
      url: publishedUrl || undefined,
      warnings: warnings.length ? warnings : undefined,
      step: totalSteps,
      totalSteps,
    });
  }

  private async writeProject(
    projectDir: string,
    brief: LeadBrief,
    spec: PageSpec,
    boot: { publicSiteId: string; apiBase: string },
  ) {
    await this.copyVendor(projectDir);
    const files = assembleLandingFiles({
      brief,
      spec,
      publicSiteId: boot.publicSiteId,
      apiBase: boot.apiBase,
      leadId: brief.leadId,
      landingSlug: brief.slug,
    });
    for (const file of files) {
      const target = path.join(projectDir, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf8');
    }
  }

  private async copyVendor(projectDir: string) {
    const kitSrc = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'packages',
      'landing-kit',
      'src',
    );
    const dest = path.join(projectDir, 'vendor', 'landing-kit');
    await fs.cp(kitSrc, dest, {
      recursive: true,
      filter: (src) =>
        !src.includes(`${path.sep}scripts`) && !src.endsWith('.spec.ts'),
    });
  }

  private async resolveVisionImagePaths(
    leadId: string,
    brief: LeadBrief,
  ): Promise<string[]> {
    const storageRoot = path.resolve(
      __dirname,
      '..',
      '..',
      'storage',
      'leads',
      leadId,
      'images',
    );
    const preferred = [
      ...brief.images.filter((img) => img.kind === 'logo'),
      ...brief.images.filter((img) => img.kind === 'photo'),
    ].slice(0, 3);

    const paths: string[] = [];
    for (const img of preferred) {
      const full = path.join(storageRoot, img.filename);
      try {
        await fs.access(full);
        paths.push(full);
      } catch {
        // skip missing
      }
    }
    if (paths.length) return paths;

    try {
      const entries = await fs.readdir(storageRoot);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        paths.push(path.join(storageRoot, name));
        if (paths.length >= 3) break;
      }
    } catch {
      return [];
    }
    return paths;
  }

  private async throwIfCancelled(job: LandingJobRuntime) {
    if (job.cancelRequested) {
      throw new JobCancelledError(job.id);
    }
    const requested = await this.jobsService.isCancelRequested(job.id);
    if (requested) {
      job.cancelRequested = true;
      throw new JobCancelledError(job.id);
    }
  }

  private async copyImages(leadId: string, projectDir: string) {
    const storageRoot = path.resolve(
      __dirname,
      '..',
      '..',
      'storage',
      'leads',
      leadId,
      'images',
    );
    const dest = path.join(projectDir, 'public', 'images');
    await fs.mkdir(dest, { recursive: true });

    let entries: string[] = [];
    try {
      entries = await fs.readdir(storageRoot);
    } catch {
      return 0;
    }

    let copied = 0;
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const from = path.join(storageRoot, name);
      const stat = await fs.stat(from);
      if (!stat.isFile()) continue;
      await fs.copyFile(from, path.join(dest, name));
      copied += 1;
    }
    return copied;
  }

  private async copyVideos(leadId: string, projectDir: string) {
    const storageRoot = path.resolve(
      __dirname,
      '..',
      '..',
      'storage',
      'leads',
      leadId,
      'videos',
    );
    const dest = path.join(projectDir, 'public', 'videos');
    await fs.mkdir(dest, { recursive: true });

    let entries: string[] = [];
    try {
      entries = await fs.readdir(storageRoot);
    } catch {
      return 0;
    }

    let copied = 0;
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const from = path.join(storageRoot, name);
      const stat = await fs.stat(from);
      if (!stat.isFile()) continue;
      await fs.copyFile(from, path.join(dest, name));
      copied += 1;
    }
    return copied;
  }

  private async mergeStoredVideos(
    leadId: string,
    brief: LeadBrief,
  ): Promise<LeadBrief> {
    const files = await this.storage.listLeadVideos(leadId);
    if (!files.length) return brief;
    const seen = new Set(brief.videos.map((item) => item.publicPath));
    const extra: BriefVideo[] = [];
    for (const file of files) {
      const publicPath = `/videos/${file.filename}`;
      if (seen.has(publicPath)) continue;
      extra.push({
        filename: file.filename,
        publicPath,
        slot: file.filename.includes('portrait')
          ? 'portrait'
          : file.filename.includes('background')
            ? 'background'
            : undefined,
      });
    }
    if (!extra.length) return brief;
    return { ...brief, videos: [...brief.videos, ...extra] };
  }

  private async resolveStockVideo(opts: {
    job: LandingJobRuntime;
    brief: LeadBrief;
    architecture: Architecture;
    configSections: LandingSectionConfig[];
    vision: VisionAnalysis | null;
    artifactDir: string;
    planModelName: string;
    onChunk: (
      stage: LandingJobRuntime['status'],
      label: string,
      extra?: Record<string, unknown>,
    ) => (_piece: string, full: string) => void;
    warnings: string[];
  }): Promise<LeadBrief> {
    const {
      job,
      brief,
      architecture,
      configSections,
      vision,
      artifactDir,
      planModelName,
      onChunk,
      warnings,
    } = opts;

    if (!heroStockVideoRequested(configSections)) {
      return brief;
    }

    const heroArch =
      architecture.sections.find((item) => item.type === 'hero') ||
      architecture.sections.find((item) => item.id === 'hero');
    if (!heroArch || !componentSupportsVideo(heroArch.component)) {
      warnings.push('vídeo Pexels ignorado: hero sem suporte a vídeo');
      await writeJson(path.join(artifactDir, 'pexels-video.json'), {
        skipped: true,
        reason: 'hero-sem-video',
        component: heroArch?.component || null,
      });
      return brief;
    }

    if (!this.pexels.hasApiKey()) {
      warnings.push('pulado: sem PEXELS_API_KEY');
      await writeJson(path.join(artifactDir, 'pexels-video.json'), {
        skipped: true,
        reason: 'sem-api-key',
      });
      return brief;
    }

    let queryChoice = heuristicPexelsQuery(brief);
    try {
      queryChoice = await this.llmService.generateJson(
        buildPexelsQueryPrompt(brief, vision),
        parsePexelsQuery,
        {
          temperature: 0.3,
          expectedShape: 'PexelsQuery',
          role: 'plan',
          model: planModelName,
          onChunk: onChunk('pexels', 'Query Pexels'),
        },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`query Pexels fallback: ${msg}`);
    }

    let search = await this.pexels.searchVideos(queryChoice.query);
    let usedQuery = queryChoice.query;
    if (!search.candidates.length && queryChoice.queryAlt !== queryChoice.query) {
      search = await this.pexels.searchVideos(queryChoice.queryAlt);
      usedQuery = queryChoice.queryAlt;
    }

    if (!search.candidates.length) {
      warnings.push('vídeo Pexels: nenhum candidato após filtro');
      await writeJson(path.join(artifactDir, 'pexels-video.json'), {
        skipped: true,
        reason: 'sem-candidatos',
        query: queryChoice,
        usedQuery,
        rateLimit: search.rateLimit,
      });
      return brief;
    }

    const picked = await this.pickPexelsCandidate({
      brief,
      vision,
      candidates: search.candidates,
      artifactDir,
      onChunk,
    });
    if (!picked) {
      warnings.push('vídeo Pexels: falha ao escolher candidato');
      return brief;
    }

    const filename = `hero-${picked.id}.mp4`;
    const saved = await this.storage.downloadVideo(
      brief.leadId,
      picked.downloadUrl,
      filename,
    );
    if (!saved) {
      warnings.push('vídeo Pexels: falha no download do MP4');
      await writeJson(path.join(artifactDir, 'pexels-video.json'), {
        skipped: true,
        reason: 'download-falhou',
        query: queryChoice,
        usedQuery,
        picked,
        rateLimit: search.rateLimit,
      });
      return brief;
    }

    const video: BriefVideo = {
      filename: saved.filename,
      publicPath: `/videos/${saved.filename}`,
      pexelsId: picked.id,
      photographer: picked.user,
      photographerUrl: picked.photographerUrl,
      pageUrl: picked.pageUrl,
    };
    const next: LeadBrief = {
      ...brief,
      videos: [
        ...brief.videos.filter((item) => item.publicPath !== video.publicPath),
        video,
      ],
    };

    await writeJson(path.join(artifactDir, 'pexels-video.json'), {
      query: queryChoice,
      usedQuery,
      picked,
      video,
      rateLimit: search.rateLimit,
    });
    await this.throwIfCancelled(job);
    return next;
  }

  private async pickPexelsCandidate(opts: {
    brief: LeadBrief;
    vision: VisionAnalysis | null;
    candidates: PexelsCandidate[];
    artifactDir: string;
    onChunk: (
      stage: LandingJobRuntime['status'],
      label: string,
      extra?: Record<string, unknown>,
    ) => (_piece: string, full: string) => void;
  }): Promise<PexelsCandidate | null> {
    const { brief, vision, candidates, artifactDir, onChunk } = opts;
    const allowedIds = candidates.map((item) => item.id);
    const posterDir = path.join(artifactDir, 'pexels-posters');
    const posterPaths: string[] = [];
    const listed = candidates.map((item, index) => ({
      id: item.id,
      duration: item.duration,
      width: item.width,
      height: item.height,
      user: item.user,
      posterIndex: undefined as number | undefined,
    }));

    for (const candidate of candidates.slice(0, 3)) {
      if (!candidate.posterUrl) continue;
      const dest = path.join(posterDir, `${candidate.id}.jpg`);
      const ok = await this.pexels.downloadPoster(candidate.posterUrl, dest);
      if (!ok) continue;
      posterPaths.push(dest);
      const row = listed.find((item) => item.id === candidate.id);
      if (row) row.posterIndex = posterPaths.length;
    }

    const prompt = buildPexelsPickPrompt({
      brief,
      candidates: listed,
      vision,
    });

    try {
      if (posterPaths.length) {
        const choice = await this.llmService.generateVisionJson(
          prompt,
          posterPaths,
          (value) => parsePexelsPick(value, allowedIds),
          {
            temperature: 0.2,
            expectedShape: 'PexelsPick',
            role: 'vision',
            keepAlive: 0,
            onChunk: onChunk('pexels', 'Escolha Pexels'),
          },
        );
        await this.llmService.unload('vision');
        return fallbackPexelsPick(candidates, choice.videoId);
      }
      const choice = await this.llmService.generateJson(
        prompt,
        (value) => parsePexelsPick(value, allowedIds),
        {
          temperature: 0.2,
          expectedShape: 'PexelsPick',
          role: 'plan',
          onChunk: onChunk('pexels', 'Escolha Pexels'),
        },
      );
      return fallbackPexelsPick(candidates, choice.videoId);
    } catch (error) {
      await this.llmService.unload('vision');
      this.logger.warn(
        `escolha Pexels fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallbackPexelsPick(candidates);
    }
  }
}

function heuristicDirection(brief: LeadBrief): CreativeDirection {
  const style = heuristicStyle(brief.category || brief.name);
  const recipe = recipeForStyle(style);
  return {
    style,
    visualLanguage: 'profissional, mobile-first',
    colorStrategy: 'catálogo fixo do design system',
    imageStrategy: brief.images.some((img) => img.kind === 'photo')
      ? 'large-photography'
      : 'minimal',
    density: 'medium',
    radius: recipe.radius,
    spacing: recipe.spacing,
    primaryCta: primaryCtaFromBrief(brief),
  };
}

function parseDirection(value: unknown, brief: LeadBrief): CreativeDirection {
  const parsed = parseCreativeDirection(value);
  if (parsed.primaryCta && !isAllowedHref(parsed.primaryCta.href, brief)) {
    parsed.primaryCta = primaryCtaFromBrief(brief);
  }
  if (!parsed.primaryCta) parsed.primaryCta = primaryCtaFromBrief(brief);
  return parsed;
}

function sanitizeCopy(
  component: ComponentId,
  raw: Record<string, unknown>,
  brief: LeadBrief,
) {
  const aliased: Record<string, unknown> = { ...raw };
  if (aliased.headline == null && typeof aliased.title === 'string') {
    aliased.headline = aliased.title;
  }
  if (aliased.description == null && typeof aliased.subtitle === 'string') {
    aliased.description = aliased.subtitle;
  }
  if (aliased.image == null && Array.isArray(aliased.imageRefs)) {
    aliased.image = aliased.imageRefs[0];
  }
  if (aliased.body == null && typeof aliased.description === 'string' && !aliased.body) {
    // keep
  }
  if (!aliased.cta && typeof aliased.ctaLabel === 'string' && typeof aliased.ctaHref === 'string') {
    aliased.cta = { label: aliased.ctaLabel, href: aliased.ctaHref };
  }
  return sanitizeProps(component, aliased, brief);
}

function validatePropsBlob(props: Record<string, unknown>, brief: LeadBrief) {
  return findInventedContacts(JSON.stringify(props), brief);
}

function withChatFeatureProps(
  features: LandingFeature[],
  brief: LeadBrief,
): Array<{ id: string; props: Record<string, unknown> }> {
  const cta = brief.contacts.whatsappUrl
    ? { whatsapp: brief.contacts.whatsappUrl }
    : undefined;
  return features.map((feature) => {
    if (feature.id === AI_CHAT_FEATURE_ID) {
      const suggestions = brief.services?.slice(0, 3) || [
        'Horários',
        'Serviços',
        'Como chegar',
      ];
      return {
        id: feature.id,
        props: {
          position: 'bottom-right',
          suggestions,
          ...(cta ? { cta } : {}),
          ...(feature.props || {}),
        },
      };
    }
    if (feature.id === AI_CONCIERGE_FEATURE_ID) {
      return {
        id: feature.id,
        props: {
          position: 'bottom-right',
          greeting: `Olá! Posso ajudar você a encontrar a solução ideal em ${brief.name}.`,
          actions: ['Quero contratar', 'Tenho uma dúvida', 'Quero saber preços'],
          ...(cta ? { cta } : {}),
          ...(feature.props || {}),
        },
      };
    }
    return { id: feature.id, props: { ...(feature.props || {}) } };
  });
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}
