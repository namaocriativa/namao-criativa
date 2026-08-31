import {
  FEATURE_CATALOG,
  type FeatureCategory,
  type FeatureMetadata,
} from "@namao/landing-kit";

type FeaturesStepProps = {
  selected: string[];
  onToggle: (id: string, enabled: boolean) => void;
};

const CATEGORY_ORDER: FeatureCategory[] = [
  "ai",
  "capture",
  "conversion",
  "content",
];

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  ai: "Inteligência",
  capture: "Captura",
  conversion: "Conversão",
  content: "Conteúdo",
};

function groupByCategory(items: FeatureMetadata[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length);
}

function FeatureIcon({ category }: { category: FeatureCategory }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (category === "ai") {
    return (
      <svg {...common}>
        <path d="M5 12.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.7 0-1.4-.1-2-.3L6 20l.8-3.2C5.7 15.7 5 14.2 5 12.5Z" />
        <path d="M9 12h.01M12 12h.01M15 12h.01" />
      </svg>
    );
  }
  if (category === "capture") {
    return (
      <svg {...common}>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    );
  }
  if (category === "conversion") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v3.2L14.5 14" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 20s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="site-wizard-feature__check"
    >
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

export function FeaturesStep({ selected, onToggle }: FeaturesStepProps) {
  const groups = groupByCategory(FEATURE_CATALOG);
  return (
    <div className="site-wizard__panel site-wizard__panel--features">
      {groups.map((group) => (
        <section key={group.category} className="site-wizard-features__group">
          <p className="site-wizard-rail__label">{group.label}</p>
          <ul className="site-wizard-features__grid">
            {group.items.map((item) => {
              const ready = item.status === "ready";
              const on = selected.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[
                      "site-wizard-feature",
                      on ? "is-on" : "",
                      ready ? "" : "is-soon",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!ready}
                    aria-pressed={ready ? on : undefined}
                    onClick={() => onToggle(item.id, ready)}
                  >
                    <span className="site-wizard-feature__icon">
                      <FeatureIcon category={item.category} />
                    </span>
                    <span className="site-wizard-feature__body">
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span
                      className={
                        ready
                          ? "site-wizard-feature__badge"
                          : "site-wizard-feature__badge is-soon"
                      }
                    >
                      {ready ? "Disponível" : "Em breve"}
                    </span>
                    {on ? <CheckMark /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
