import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIgReportPdf, formatIgReportText, igReportPdfName } from "./ig-skill-report-export";

const report = {
  overview: {
    who: "Ação Café",
    sells: "café especial",
    audience: "público local",
    stage: "em construção",
  },
  voice: { adjectives: ["direto", "próximo"], quotes: ["o melhor da manhã"] },
  pillars: ["origem", "preparo"],
  gaps: ["prova social"],
  plan: [{ week: "Semana 1", mix: "2 Reels", goal: "gerar conversa" }],
  ideas: [
    {
      title: "Por trás do grão",
      hook: "De onde vem o café",
      caption: "Comenta ORIGEM para o guia.",
      format: "reel",
      commentKeyword: "ORIGEM",
    },
  ],
  corpus: { username: "acao.cafe", postCount: 12, postsPerWeek: 3 },
};

describe("formatIgReportText", () => {
  it("monta o relatório em texto", () => {
    const text = formatIgReportText(report);
    assert.match(text, /Skill Instagram/);
    assert.match(text, /@acao\.cafe · 12 posts · 3\/semana/);
    assert.match(text, /Ação Café — café especial/);
    assert.match(text, /Público: público local/);
    assert.match(text, /1\. Por trás do grão \(reel\)/);
    assert.match(text, /Palavra: ORIGEM/);
  });
});

describe("buildIgReportPdf", () => {
  it("gera um PDF com acentos em WinAnsi", () => {
    const bytes = buildIgReportPdf(report);
    const pdf = Buffer.from(bytes).toString("latin1");
    assert.match(pdf, /^%PDF-1\.4/);
    assert.match(pdf, /%%EOF$/);
    assert.ok(pdf.includes("A\\347\\343o Caf\\351"));
    assert.ok(pdf.includes("p\\372blico local"));
    assert.ok(pdf.includes("Relat\\363rio Skill Instagram"));
    const start = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    assert.equal(pdf.slice(start, start + 4), "xref");
  });

  it("nomeia o arquivo pelo usuário", () => {
    assert.equal(igReportPdfName(report), "relatorio-skill-instagram-acao.cafe.pdf");
  });
});
