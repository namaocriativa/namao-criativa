import { useEffect, useMemo, useState } from "react";
import type { Lead } from "../types";
import type { CopywriterPayload } from "./wizard-payload";

type CopywriterStepProps = {
  leadId: string | null;
  value: CopywriterPayload;
  onChange: (
    next: CopywriterPayload | ((current: CopywriterPayload) => CopywriterPayload),
  ) => void;
};

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function servicesToLines(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean).join("\n");
  }
  const text = asText(value);
  if (!text) return "";
  return text
    .split(/[|,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function linesToServices(value: string): string[] {
  return value
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

const ENRICHMENT_FIELDS: Array<{ key: keyof Lead; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "category", label: "Categoria" },
  { key: "description", label: "Descrição" },
  { key: "services", label: "Serviços" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "website", label: "Site" },
  { key: "instagram", label: "Instagram" },
  { key: "address", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "rating", label: "Avaliação" },
];

function fieldValue(lead: Lead, key: keyof Lead): string {
  if (key === "services") return servicesToLines(lead.services) || "";
  if (key === "rating") {
    if (lead.rating == null) return "";
    return lead.reviewCount != null
      ? `${lead.rating} · ${lead.reviewCount} avaliações`
      : String(lead.rating);
  }
  return asText(lead[key]);
}

export function CopywriterStep({ leadId, value, onChange }: CopywriterStepProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [status, setStatus] = useState("Carregando enrichment…");

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setStatus("Abra o wizard a partir de um lead.");
      return;
    }
    let cancelled = false;
    setStatus("Carregando enrichment…");
    void fetch(`/leads/${encodeURIComponent(leadId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Lead não encontrado"))))
      .then((data: Lead) => {
        if (cancelled) return;
        setLead(data);
        setStatus("");
        onChange((current) => ({
          category: current.category || asText(data.category),
          description: current.description || asText(data.description),
          services: current.services?.length
            ? current.services
            : linesToServices(servicesToLines(data.services)),
          address: current.address || asText(data.address),
          notes: current.notes || "",
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLead(null);
        setStatus(
          error instanceof Error ? error.message : "Não foi possível carregar o lead.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, onChange]);

  const collected = useMemo(() => {
    if (!lead) return [];
    return ENRICHMENT_FIELDS.map((field) => ({
      ...field,
      value: fieldValue(lead, field.key),
    }));
  }, [lead]);

  const missing = collected.filter((item) => !item.value);
  const present = collected.filter((item) => item.value);
  const photoCount = lead?.images?.length || lead?._count?.images || 0;

  return (
    <div className="site-wizard__panel site-wizard__panel--copywriter">
      <aside className="site-wizard-brief">
        <p className="site-wizard-rail__label">Enrichment</p>
        {status ? <p className="prompt-hint">{status}</p> : null}
        {lead ? (
          <>
            <p className="site-wizard-brief__name">{lead.name || "Lead"}</p>
            <p className="prompt-hint">
              {photoCount
                ? `${photoCount} imagem(ns) no lead.`
                : "Nenhuma imagem no enrichment."}
            </p>
            {present.length ? (
              <dl className="site-wizard-brief__list">
                {present.map((item) => (
                  <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {missing.length ? (
              <>
                <p className="site-wizard-rail__label">Faltando</p>
                <div className="site-wizard-brief__missing">
                  {missing.map((item) => (
                    <span key={item.key}>{item.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="prompt-hint">Enrichment completo para o copywriter.</p>
            )}
          </>
        ) : null}
      </aside>
      <div className="site-wizard-copy-form">
        <p className="site-wizard-picker__title">Fatos para o copywriter</p>
        <p className="prompt-hint">
          O modelo só escreve com fatos. Complete o que o enrichment não
          trouxe — sem inventar telefone, avaliação ou depoimento.
        </p>
        <label className="site-wizard-field">
          <span>Categoria</span>
          <input
            type="text"
            value={value.category || ""}
            placeholder="Ex.: estética, advocacia, clínica"
            onChange={(event) =>
              onChange({ ...value, category: event.target.value })
            }
          />
        </label>
        <label className="site-wizard-field">
          <span>Serviços (um por linha)</span>
          <textarea
            rows={6}
            value={(value.services || []).join("\n")}
            placeholder={"Limpeza de pele\nBotox\nPreenchimento"}
            onChange={(event) =>
              onChange({
                ...value,
                services: linesToServices(event.target.value),
              })
            }
          />
        </label>
        <label className="site-wizard-field">
          <span>Descrição</span>
          <textarea
            rows={5}
            value={value.description || ""}
            placeholder="Quem é, para quem atende, o que oferece. Só o que for verdade."
            onChange={(event) =>
              onChange({ ...value, description: event.target.value })
            }
          />
        </label>
        <label className="site-wizard-field">
          <span>Endereço</span>
          <input
            type="text"
            value={value.address || ""}
            placeholder="Rua, número, bairro — se for público"
            onChange={(event) =>
              onChange({ ...value, address: event.target.value })
            }
          />
        </label>
        <label className="site-wizard-field">
          <span>Notas extras</span>
          <textarea
            rows={4}
            value={value.notes || ""}
            placeholder="Diferenciais, público, horários reais. Entram no brief junto da descrição."
            onChange={(event) =>
              onChange({ ...value, notes: event.target.value })
            }
          />
        </label>
      </div>
    </div>
  );
}
