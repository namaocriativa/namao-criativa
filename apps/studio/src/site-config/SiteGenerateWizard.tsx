import { useEffect, useMemo, useState } from "react";
import {
  COLOR_INTENSITY_GUIDE,
  COLOR_ROLES,
  FEATURE_CATALOG,
  MAP_FEATURE_ID,
  componentSupportsVideo,
  defaultThemePayload,
  mapTargetSections,
  resolveMapSectionId,
  variantsForFamily,
  variantsForUserType,
  type ThemePayload,
} from "@namao/landing-kit";
import { listComponents } from "../ui-lib";
import { api } from "../api";
import { kitComponentLabel, onComponentRename } from "../ui-lib/component-names";
import { getWizardLeadId, wizardProfileApi } from "./mount-wizard";
import { CopywriterStep } from "./CopywriterStep";
import { ColorsStep } from "./ColorsStep";
import { FeaturesStep } from "./FeaturesStep";
import { MediaStep, type HeroVideoSlot } from "./MediaStep";
import { SectionComposer } from "./SectionComposer";
import {
  defaultSectionConfigs,
  type LandingSectionConfig,
} from "./section-catalog";
import {
  compactSectionMedia,
  loadWizardDraft,
  saveWizardDraft,
  toGeneratePayload,
  wizardStateFromConfig,
  type CopywriterPayload,
  type GeneratePayload,
  type StockVideoFlags,
  type VariantLocks,
} from "./wizard-payload";

const STEPS = [
  "Seções",
  "Variantes",
  "Médias",
  "Copywriter",
  "Features",
  "Cores",
  "Revisão",
] as const;

const SPLIT_VIDEO_HERO = "hero.split-video";
const OVERLAYS_FOCUS = "__overlays__";

type SiteGenerateWizardProps = {
  onChange: (payload: GeneratePayload) => void;
  onClose: () => void;
  onConfirm: () => void;
};

function variantsForSection(type: string) {
  const family = variantsForUserType(type);
  if (type === "testimonials") {
    const proof = variantsForFamily("social-proof");
    const ids = new Set(family.map((item) => item.id));
    return [...proof.filter((item) => !ids.has(item.id)), ...family];
  }
  return family.length ? family : variantsForUserType("custom");
}

function previewSrc(id: string): string {
  return `/kit-preview.html?id=${encodeURIComponent(id)}`;
}

function StepCheck() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 8.4 6.6 11.4 12.5 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function clampStep(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), STEPS.length - 1);
}

export function SiteGenerateWizard({
  onChange,
  onClose,
  onConfirm,
}: SiteGenerateWizardProps) {
  const leadId = getWizardLeadId();
  const [seed] = useState(() => loadWizardDraft(leadId));
  const [step, setStep] = useState(() => clampStep(seed?.step ?? 0));
  const [sections, setSections] = useState<LandingSectionConfig[]>(
    () => seed?.sections ?? defaultSectionConfigs(),
  );
  const [locks, setLocks] = useState<VariantLocks>(() => seed?.locks ?? {});
  const [overlays, setOverlays] = useState<string[]>(() => seed?.overlays ?? []);
  const [features, setFeatures] = useState<string[]>(() => seed?.features ?? []);
  const [mapSectionId, setMapSectionId] = useState<string | null>(
    () => seed?.mapSectionId ?? null,
  );
  const [copywriter, setCopywriter] = useState<CopywriterPayload>(
    () => seed?.copywriter ?? {},
  );
  const [theme, setTheme] = useState<ThemePayload>(
    () => seed?.theme ?? defaultThemePayload(),
  );
  const [stockVideoBySection, setStockVideoBySection] = useState<StockVideoFlags>(
    () => seed?.stockVideoBySection ?? {},
  );
  const [hydrated, setHydrated] = useState(() => Boolean(seed) || !leadId);
  const [focusId, setFocusId] = useState<string | null>(
    () => seed?.focusId ?? seed?.sections[0]?.id ?? defaultSectionConfigs()[0]?.id ?? null,
  );
  const [, setNameEpoch] = useState(0);

  useEffect(() => onComponentRename(() => setNameEpoch((value) => value + 1)), []);

  useEffect(() => {
    if (seed || !leadId) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void api(wizardProfileApi(leadId))
      .then((res) => (res.ok ? res.json() : null))
      .then((lead: { generateConfig?: unknown } | null) => {
        if (cancelled) return;
        const state = wizardStateFromConfig(lead?.generateConfig);
        if (state) {
          setSections(state.sections);
          setLocks(state.locks);
          setOverlays(state.overlays);
          setFeatures(state.features);
          setMapSectionId(state.mapSectionId);
          setCopywriter(state.copywriter);
          setStockVideoBySection(state.stockVideoBySection);
          if (state.theme) setTheme(state.theme);
          setFocusId(state.sections[0]?.id ?? null);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, seed]);

  const overlayDefs = useMemo(() => listComponents(), []);
  const mapOn = features.includes(MAP_FEATURE_ID);
  const mapSections = useMemo(() => mapTargetSections(sections), [sections]);
  const overlaysFocused = focusId === OVERLAYS_FOCUS;
  const focused = overlaysFocused
    ? null
    : sections.find((item) => item.id === focusId) || sections[0] || null;
  const focusedLock = focused ? locks[focused.id] ?? null : null;
  const focusedVariants = focused ? variantsForSection(focused.type) : [];
  const previewId = overlaysFocused
    ? null
    : focusedLock || focusedVariants[0]?.id || null;
  const previewIsReference = Boolean(focused && !focusedLock && previewId);
  const heroSection = sections.find((item) => item.type === "hero") || null;
  const heroLock = heroSection ? locks[heroSection.id] ?? null : null;
  const heroSupportsStockVideo = Boolean(
    heroSection &&
      (heroLock
        ? componentSupportsVideo(heroLock)
        : variantsForSection(heroSection.type).some((item) =>
            componentSupportsVideo(item.id),
          )),
  );

  useEffect(() => {
    if (!hydrated) return;
    onChange(
      toGeneratePayload(
        sections,
        locks,
        overlays,
        features,
        stockVideoBySection,
        copywriter,
        theme,
        mapSectionId,
      ),
    );
    saveWizardDraft(leadId, {
      step,
      focusId,
      sections,
      locks,
      overlays,
      features,
      mapSectionId,
      copywriter,
      stockVideoBySection,
      theme,
    });
  }, [
    hydrated,
    leadId,
    step,
    focusId,
    sections,
    locks,
    overlays,
    features,
    stockVideoBySection,
    copywriter,
    theme,
    mapSectionId,
    onChange,
  ]);

  useEffect(() => {
    if (!mapOn) return;
    setMapSectionId((current) => resolveMapSectionId(sections, current));
  }, [sections, mapOn]);

  function handlePuckChange(next: LandingSectionConfig[]) {
    setSections((prev) => {
      const mediaById = new Map(
        prev.map((item) => [item.id, item.media] as const),
      );
      return next.map((section) => {
        const media = mediaById.get(section.id);
        return media ? { ...section, media } : section;
      });
    });
    setLocks((prev) => {
      const kept: VariantLocks = {};
      for (const section of next) {
        if (section.id in prev) kept[section.id] = prev[section.id];
      }
      return kept;
    });
    setStockVideoBySection((prev) => {
      const kept: StockVideoFlags = {};
      for (const section of next) {
        if (section.type === "hero" && prev[section.id]) {
          kept[section.id] = true;
        }
      }
      return kept;
    });
    setFocusId((current) =>
      current === OVERLAYS_FOCUS || next.some((item) => item.id === current)
        ? current
        : (next[0]?.id ?? null),
    );
  }

  function setComponent(id: string, component: string | null) {
    setLocks((prev) => {
      const next = { ...prev, [id]: component };
      if (component === SPLIT_VIDEO_HERO) {
        const header = sections.find((section) => section.type === "header");
        if (header && next[header.id] == null) {
          next[header.id] = "navbar.overlay";
        }
      }
      return next;
    });
    if (component && !componentSupportsVideo(component)) {
      setStockVideoBySection((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function toggleOverlay(id: string) {
    setOverlays((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleFeature(id: string, enabled: boolean) {
    if (!enabled) return;
    const on = features.includes(id);
    if (id === MAP_FEATURE_ID && !on) {
      setMapSectionId((current) => resolveMapSectionId(sections, current));
    }
    setFeatures((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleMap() {
    const on = features.includes(MAP_FEATURE_ID);
    if (!on) {
      setMapSectionId((current) => resolveMapSectionId(sections, current));
    }
    setFeatures((prev) =>
      prev.includes(MAP_FEATURE_ID)
        ? prev.filter((item) => item !== MAP_FEATURE_ID)
        : [...prev, MAP_FEATURE_ID],
    );
  }

  function patchMedia(
    sectionId: string,
    media: LandingSectionConfig["media"] | undefined,
  ) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, media } : section,
      ),
    );
  }

  function patchHeroVideo(slot: HeroVideoSlot, publicPath: string) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.type !== "hero") return section;
        const next = { ...section.media };
        if (slot === "background") next.video = publicPath;
        else next.portraitVideo = publicPath;
        return { ...section, media: compactSectionMedia(next) };
      }),
    );
  }

  function mediaSummary(section: LandingSectionConfig): string {
    const count = section.media?.images?.length || 0;
    const parts = [
      count ? `${count} foto(s)` : "",
      section.media?.video ? "vídeo fundo" : "",
      section.media?.portraitVideo ? "vídeo retrato" : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }

  const nextLabel = STEPS[step + 1];

  return (
    <>
      <header className="site-wizard-modal__header">
        <h3 id="site-wizard-title" className="visually-hidden">
          Gerar site
        </h3>
        <ol className="site-wizard__steps">
          {STEPS.map((label, index) => {
            const state =
              index < step ? "is-done" : index === step ? "is-active" : "";
            return (
              <li key={label} className={state || undefined}>
                <button
                  type="button"
                  className={index === step ? "active" : ""}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => setStep(index)}
                >
                  <span className="site-wizard__step-index">
                    {index < step ? <StepCheck /> : index + 1}
                  </span>
                  <span className="site-wizard__step-label">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="site-wizard-modal__close"
          onClick={onClose}
        >
          Fechar
        </button>
      </header>
      <div className="site-wizard">
      <div hidden={step !== 0} className="site-wizard__panel">
        {hydrated ? (
          <SectionComposer
            initialSections={sections}
            onChange={handlePuckChange}
          />
        ) : (
          <p className="prompt-hint">Carregando a última geração…</p>
        )}
      </div>

      {step === 1 ? (
        <div className="site-wizard__panel site-wizard__panel--variants">
          <aside className="site-wizard-rail">
            <p className="site-wizard-rail__label">Seções</p>
            <ul className="site-wizard-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className={
                      !overlaysFocused && section.id === focused?.id
                        ? "site-wizard-section active"
                        : "site-wizard-section"
                    }
                    onClick={() => setFocusId(section.id)}
                  >
                    <strong>{section.title}</strong>
                    <small>
                      {locks[section.id]
                        ? kitComponentLabel(locks[section.id] || "")
                        : "Auto (IA)"}
                    </small>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={
                    overlaysFocused
                      ? "site-wizard-section active"
                      : "site-wizard-section"
                  }
                  onClick={() => setFocusId(OVERLAYS_FOCUS)}
                >
                  <strong>Overlays</strong>
                  <small>
                    {[
                      ...overlays.map(
                        (id) =>
                          overlayDefs.find((item) => item.id === id)?.name ||
                          id,
                      ),
                      mapOn ? "Google Maps" : "",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Nenhum"}
                  </small>
                </button>
              </li>
            </ul>
          </aside>
          <div className="site-wizard-picker">
            {overlaysFocused ? (
              <>
                <p className="site-wizard-picker__title">Overlays</p>
                <p className="prompt-hint">
                  Overlays ficam fixos na viewport. Google Maps entra na seção
                  escolhida. As props da aba UI Lib entram na página gerada.
                </p>
                <div className="site-wizard-variants">
                  {overlayDefs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        overlays.includes(item.id)
                          ? "site-wizard-variant active"
                          : "site-wizard-variant"
                      }
                      onClick={() => toggleOverlay(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <code>{item.id}</code>
                      <p>{item.description}</p>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={
                      mapOn
                        ? "site-wizard-variant active"
                        : "site-wizard-variant"
                    }
                    onClick={toggleMap}
                    aria-pressed={mapOn}
                  >
                    <strong>Google Maps</strong>
                    <code>{MAP_FEATURE_ID}</code>
                    <p>
                      Embed do endereço público na seção escolhida. Vários
                      overlays podem ficar ligados junto.
                    </p>
                  </button>
                </div>
                {mapOn ? (
                  <label className="site-wizard-map-target">
                    <span>Seção do mapa</span>
                    <select
                      value={mapSectionId || mapSections[0]?.id || ""}
                      onChange={(event) =>
                        setMapSectionId(event.target.value || null)
                      }
                    >
                      {mapSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : focused ? (
              <>
                <p className="site-wizard-picker__title">{focused.title}</p>
                <p className="prompt-hint">
                  Auto deixa o Page Architect escolher. Uma variante trava o
                  ID no spec.
                </p>
                <div className="site-wizard-variants">
                  <button
                    type="button"
                    className={
                      focusedLock == null
                        ? "site-wizard-variant active"
                        : "site-wizard-variant"
                    }
                    onClick={() => setComponent(focused.id, null)}
                  >
                    <strong>Auto (IA)</strong>
                    <p>O architect escolhe a variante com o brief.</p>
                  </button>
                  {focusedVariants.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        focusedLock === item.id
                          ? "site-wizard-variant active"
                          : "site-wizard-variant"
                      }
                      onClick={() => setComponent(focused.id, item.id)}
                    >
                      <strong>{kitComponentLabel(item.id)}</strong>
                      <code>{item.id}</code>
                      <p>{item.description}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="prompt-hint">Selecione uma seção à esquerda.</p>
            )}
          </div>
          <div className="site-wizard-preview-pane">
            {previewId ? (
              <>
                <p className="site-wizard-rail__label">
                  {previewIsReference
                    ? `Referência · ${kitComponentLabel(previewId)}`
                    : kitComponentLabel(previewId)}
                </p>
                <iframe
                  className="site-wizard-preview"
                  title={`Preview ${previewId}`}
                  src={previewSrc(previewId)}
                />
                {previewIsReference ? (
                  <p className="prompt-hint">
                    Preview de uma variante típica. Auto não trava o ID — a IA
                    escolhe na geração.
                  </p>
                ) : null}
              </>
            ) : overlaysFocused ? (
              <p className="prompt-hint">
                Overlay fica fixo na viewport. Google Maps entra na seção
                escolhida ao centro.
              </p>
            ) : (
              <p className="prompt-hint">Selecione uma seção para ver o preview.</p>
            )}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <MediaStep
          leadId={leadId}
          sections={sections}
          heroSupportsStockVideo={heroSupportsStockVideo}
          stockVideo={Boolean(
            heroSection && stockVideoBySection[heroSection.id],
          )}
          onStockVideo={(on) => {
            if (!heroSection) return;
            setStockVideoBySection((prev) => ({
              ...prev,
              [heroSection.id]: on,
            }));
          }}
          onPatchMedia={patchMedia}
          onPatchHeroVideo={patchHeroVideo}
        />
      ) : null}

      {step === 3 ? (
        <CopywriterStep
          leadId={leadId}
          value={copywriter}
          onChange={setCopywriter}
        />
      ) : null}

      {step === 4 ? (
        <FeaturesStep selected={features} onToggle={toggleFeature} />
      ) : null}

      {step === 5 ? (
        <ColorsStep value={theme} onChange={setTheme} />
      ) : null}

      {step === 6 ? (
        <div className="site-wizard__panel site-wizard__panel--review">
          <div className="site-wizard-review-grid">
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Seções</p>
              <ul>
                {sections.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span>
                      {locks[item.id]
                        ? kitComponentLabel(locks[item.id] || "")
                        : "Auto (IA)"}
                    </span>
                    <small>{mediaSummary(item) || "Mídia automática"}</small>
                  </li>
                ))}
              </ul>
            </section>
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Overlays</p>
              <p>
                {overlays.length
                  ? overlays
                      .map(
                        (id) =>
                          overlayDefs.find((item) => item.id === id)?.name ||
                          id,
                      )
                      .join(", ")
                  : "Nenhum overlay ligado."}
              </p>
              <p>
                {mapOn
                  ? `Google Maps · ${
                      sections.find((item) => item.id === mapSectionId)
                        ?.title || mapSectionId || "seção automática"
                    }`
                  : "Sem Google Maps."}
              </p>
            </section>
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Features</p>
              <p>
                {features.length
                  ? features
                      .map(
                        (id) =>
                          FEATURE_CATALOG.find((item) => item.id === id)
                            ?.name || id,
                      )
                      .join(", ")
                  : "Nenhum módulo ligado."}
              </p>
            </section>
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Copywriter</p>
              <p>
                {copywriter.category ||
                copywriter.description ||
                copywriter.services?.length ||
                copywriter.address ||
                copywriter.notes
                  ? [
                      copywriter.category,
                      copywriter.services?.length
                        ? `${copywriter.services.length} serviço(s)`
                        : "",
                      copywriter.description ? "descrição" : "",
                      copywriter.address ? "endereço" : "",
                      copywriter.notes ? "notas" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Só o enrichment."}
              </p>
            </section>
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Cores</p>
              <div className="site-wizard-review-swatches">
                {COLOR_ROLES.map((role) => (
                  <span key={role.key} title={`${role.label} ${theme.colors[role.key]}`}>
                    <i style={{ background: theme.colors[role.key] }} />
                    {role.label}
                  </span>
                ))}
              </div>
              <p>{COLOR_INTENSITY_GUIDE[theme.intensity].label}</p>
            </section>
            <section className="site-wizard-review-card">
              <p className="site-wizard-rail__label">Pexels</p>
              <p>
                {Object.values(stockVideoBySection).some(Boolean)
                  ? "Vídeo genérico do nicho ligado no hero."
                  : "Sem vídeo Pexels."}
              </p>
            </section>
          </div>
        </div>
      ) : null}

      <div className="site-wizard__nav">
        <button
          type="button"
          className="site-wizard__nav-back"
          disabled={!hydrated || step === 0}
          onClick={() => setStep((current) => current - 1)}
        >
          Voltar
        </button>
        {step === STEPS.length - 1 ? (
          <button
            type="button"
            className="site-wizard__nav-next"
            disabled={!hydrated}
            onClick={onConfirm}
          >
            Confirmar e gerar
          </button>
        ) : (
          <button
            type="button"
            className="site-wizard__nav-next"
            disabled={!hydrated}
            onClick={() => setStep((current) => current + 1)}
          >
            Continuar para {nextLabel}
          </button>
        )}
      </div>
    </div>
    </>
  );
}
