import type { Config, Data } from "@puckeditor/core";
import type { ReactNode } from "react";
import {
  CUSTOM_SECTION_TYPE,
  PRESET_SECTIONS,
  defaultSectionConfigs,
  slugifySectionId,
  uniqueSectionId,
  type LandingSectionConfig,
} from "./section-catalog";

export type SectionBlockProps = {
  title?: string;
  description?: string;
};

function SectionCard({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <article className="puck-section-card">
      <div className="puck-section-card__top">
        <p className="puck-section-card__kicker">{kicker}</p>
        <span className="puck-section-card__edit">Editar</span>
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
    </article>
  );
}

function sectionFields() {
  return {
    title: { type: "text" as const, label: "Título" },
    description: {
      type: "textarea" as const,
      label: "Descrição para a IA",
    },
  };
}

const presetComponents = Object.fromEntries(
  PRESET_SECTIONS.map((section) => [
    section.type,
    {
      label: section.title,
      fields: sectionFields(),
      defaultProps: {
        title: section.title,
        description: section.description,
      },
      render: ({ title, description }: SectionBlockProps) => (
        <SectionCard
          kicker={section.type}
          title={title || section.title}
          description={description || section.description}
        />
      ),
    },
  ]),
);

export const sectionPuckConfig = {
  categories: {
    padrao: {
      title: "Mais usadas",
      defaultExpanded: true,
      components: PRESET_SECTIONS.filter((item) => item.default).map(
        (item) => item.type,
      ),
    },
    extras: {
      title: "Extras",
      defaultExpanded: true,
      components: [
        ...PRESET_SECTIONS.filter((item) => !item.default).map(
          (item) => item.type,
        ),
        CUSTOM_SECTION_TYPE,
      ],
    },
  },
  root: {
    render: ({ children }: { children?: ReactNode }) => (
      <div className="puck-landing-root">{children}</div>
    ),
  },
  components: {
    ...presetComponents,
    [CUSTOM_SECTION_TYPE]: {
      label: "Seção personalizada",
      fields: sectionFields(),
      defaultProps: {
        title: "Nova seção",
        description:
          "Diga o que esta seção deve comunicar, só com fatos do brief.",
      },
      render: ({ title, description }: SectionBlockProps) => (
        <SectionCard
          kicker="custom"
          title={title || "Nova seção"}
          description={
            description || "Descreva o propósito desta seção para a IA."
          }
        />
      ),
    },
  },
} as Config;

export function defaultPuckData(): Data {
  return sectionsToPuckData(defaultSectionConfigs());
}

export function sectionsToPuckData(sections: LandingSectionConfig[]): Data {
  return {
    root: { props: {} },
    content: sections.map((section) => ({
      type: section.type,
      props: {
        id: section.id,
        title: section.title,
        description: section.description,
      },
    })),
  };
}

export function puckDataToSections(data: Data): LandingSectionConfig[] {
  const used = new Set<string>();
  return (data.content || []).map((item) => {
    const type = String(item.type || CUSTOM_SECTION_TYPE);
    const title = String(item.props?.title || type).trim() || type;
    const description = String(item.props?.description || "").trim();
    const rawId = String(item.props?.id || "").trim();
    const preferred =
      rawId && !rawId.endsWith("-default")
        ? rawId
        : type === CUSTOM_SECTION_TYPE
          ? slugifySectionId(title)
          : type;
    return {
      id: uniqueSectionId(preferred, used),
      type,
      title,
      description:
        description ||
        PRESET_SECTIONS.find((section) => section.type === type)?.description ||
        title,
    };
  });
}
