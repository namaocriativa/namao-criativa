import { useEffect, useRef, useState } from "react";
import {
  COLOR_INTENSITY_GUIDE,
  COLOR_INTENSITY_IDS,
  COLOR_ROLES,
  contrastText,
  generatePalette,
  parseHex,
  type ThemeColors,
  type ThemePayload,
} from "@namao/landing-kit";

type ColorsStepProps = {
  value: ThemePayload;
  onChange: (next: ThemePayload) => void;
};

type LockedRoles = Partial<Record<keyof ThemeColors, boolean>>;

export function ColorsStep({ value, onChange }: ColorsStepProps) {
  const [locked, setLocked] = useState<LockedRoles>({});
  const [drafts, setDrafts] = useState<ThemeColors>(value.colors);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setDrafts(value.colors);
  }, [value.colors]);

  function generate() {
    const kept: Partial<ThemeColors> = {};
    for (const { key } of COLOR_ROLES) {
      if (lockedRef.current[key]) kept[key] = valueRef.current.colors[key];
    }
    onChange({ ...valueRef.current, colors: generatePalette(kept) });
  }

  function setRole(key: keyof ThemeColors, raw: string) {
    const hex = parseHex(raw);
    if (!hex) return;
    onChange({
      ...valueRef.current,
      colors: { ...valueRef.current.colors, [key]: hex },
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      generate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="site-wizard__panel site-wizard__panel--colors">
      <div className="site-wizard-colors">
        <div className="site-wizard-colors__toolbar">
          <button type="button" onClick={generate}>
            Gerar paleta
          </button>
          <p className="prompt-hint">
            Espaço gera de novo. Trave uma faixa para mantê-la. Clique para
            editar o hex.
          </p>
        </div>
        <div className="site-wizard-colors__strips" role="list">
          {COLOR_ROLES.map((role) => {
            const hex = value.colors[role.key];
            const fg = contrastText(hex);
            const isLocked = Boolean(locked[role.key]);
            return (
              <div
                key={role.key}
                className="site-wizard-colors__strip"
                role="listitem"
                style={{ background: hex, color: fg }}
              >
                <label className="site-wizard-colors__swatch">
                  <span className="site-wizard-colors__label">{role.label}</span>
                  <input
                    type="color"
                    value={hex}
                    aria-label={`${role.label} — escolher cor`}
                    onChange={(event) => setRole(role.key, event.target.value)}
                  />
                  <input
                    className="site-wizard-colors__hex"
                    value={drafts[role.key]}
                    spellCheck={false}
                    aria-label={`${role.label} — hex`}
                    onChange={(event) => {
                      const next = event.target.value;
                      setDrafts((prev) => ({ ...prev, [role.key]: next }));
                      const hexValue = parseHex(next);
                      if (hexValue) setRole(role.key, hexValue);
                    }}
                    onBlur={() =>
                      setDrafts((prev) => ({ ...prev, [role.key]: hex }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="site-wizard-colors__lock"
                  aria-pressed={isLocked}
                  aria-label={
                    isLocked ? `Destravar ${role.label}` : `Travar ${role.label}`
                  }
                  onClick={() =>
                    setLocked((prev) => ({ ...prev, [role.key]: !prev[role.key] }))
                  }
                >
                  {isLocked ? "Travada" : "Travar"}
                </button>
              </div>
            );
          })}
        </div>
        <fieldset className="site-wizard-colors__intensity">
          <legend>Intensidade</legend>
          <div className="site-wizard-colors__levels">
            {COLOR_INTENSITY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={
                  value.intensity === id
                    ? "site-wizard-variant active"
                    : "site-wizard-variant"
                }
                onClick={() => onChange({ ...value, intensity: id })}
              >
                <strong>{COLOR_INTENSITY_GUIDE[id].label}</strong>
                <p>{COLOR_INTENSITY_GUIDE[id].colorStrategy}</p>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
