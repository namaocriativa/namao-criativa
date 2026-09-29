export type IgReportIdea = {
  title?: string;
  hook?: string;
  caption?: string;
  format?: string;
  commentKeyword?: string;
};

export type IgReportExport = {
  overview?: { who?: string; sells?: string; audience?: string; stage?: string };
  voice?: { adjectives?: string[]; quotes?: string[] };
  pillars?: string[];
  gaps?: string[];
  plan?: Array<{ week?: string; mix?: string; goal?: string }>;
  ideas?: IgReportIdea[];
  corpus?: { postCount?: number; postsPerWeek?: number; username?: string | null };
};

type PdfLine = { text: string; size: number; bold: boolean; gap: number };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const WINANSI: Record<string, number> = {
  "\u201c": 0x93,
  "\u201d": 0x94,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u2022": 0x95,
  "\u2026": 0x85,
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function linesOf(items: Array<string | undefined>, bullet = "- "): string[] {
  const rows = items.map((item) => clean(item)).filter(Boolean);
  return rows.length ? rows.map((item) => `${bullet}${item}`) : ["—"];
}

export function formatIgReportText(report: IgReportExport): string {
  const ov = report.overview || {};
  const voice = report.voice || {};
  const corpus = report.corpus || {};
  const handle = corpus.username ? `@${corpus.username}` : "feed";
  const blocks = [
    "Relatório",
    "Skill Instagram",
    "",
    `${handle} · ${corpus.postCount ?? 0} posts · ${corpus.postsPerWeek ?? 0}/semana`,
    "",
    "Overview",
    `${clean(ov.who)} — ${clean(ov.sells)}. Público: ${clean(ov.audience)}. Estágio: ${clean(ov.stage)}.`,
    "",
    "Voz",
    clean((voice.adjectives || []).join(", ")) || "—",
    ...linesOf((voice.quotes || []).map((quote) => `“${quote}”`)),
    "",
    "Pilares",
    ...linesOf(report.pillars || []),
    "",
    "Gaps",
    ...linesOf(report.gaps || []),
    "",
    "Plano",
    ...linesOf(
      (report.plan || []).map(
        (week) => `${clean(week.week)} · ${clean(week.mix)} — ${clean(week.goal)}`,
      ),
    ),
    "",
    "Ideias",
    ...(report.ideas || []).flatMap((idea, index) => {
      const rows = [
        `${index + 1}. ${clean(idea.title) || "Post"} (${clean(idea.format) || "post"})`,
      ];
      if (clean(idea.hook)) rows.push(`   ${clean(idea.hook)}`);
      if (clean(idea.caption)) rows.push(`   ${clean(idea.caption)}`);
      if (clean(idea.commentKeyword)) rows.push(`   Palavra: ${clean(idea.commentKeyword)}`);
      return rows;
    }),
  ];
  if (!(report.ideas || []).length) blocks.push("—");
  return blocks.join("\n").trim();
}

export function igReportPdfName(report: IgReportExport): string {
  const user = clean(report.corpus?.username).replace(/[^\w.-]+/g, "") || "instagram";
  return `relatorio-skill-instagram-${user}.pdf`;
}

function pdfText(value: string): string {
  let out = "";
  for (const ch of value) {
    const mapped = WINANSI[ch];
    const code = mapped ?? ch.codePointAt(0) ?? 63;
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (code === 0xa0) out += " ";
    else if (code >= 32 && code <= 126) out += ch;
    else if ((code >= 128 && code <= 159) || (code >= 160 && code <= 255)) {
      out += `\\${code.toString(8).padStart(3, "0")}`;
    } else out += "?";
  }
  return out;
}

function charWidth(code: number): number {
  if (code === 32) return 0.278;
  const ch = String.fromCodePoint(code);
  if ("ijl.,:;!'|".includes(ch)) return 0.28;
  if ("mwMW@%".includes(ch)) return 0.9;
  if (code >= 48 && code <= 57) return 0.556;
  if (ch === ch.toUpperCase() && /[A-ZÀ-Ý]/.test(ch)) return 0.72;
  return 0.5;
}

function measure(text: string, size: number, bold: boolean): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch.codePointAt(0) ?? 32) * size;
  return width * (bold ? 1.08 : 1);
}

function wrap(text: string, size: number, bold: boolean): string[] {
  const parts = text.split(/\n+/);
  const rows: string[] = [];
  for (const part of parts) {
    const words = clean(part).split(" ").filter(Boolean);
    if (!words.length) continue;
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && measure(next, size, bold) > CONTENT_W) {
        rows.push(current);
        current = word;
      } else {
        current = next;
      }
      while (measure(current, size, bold) > CONTENT_W && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && measure(current.slice(0, cut), size, bold) > CONTENT_W) cut -= 1;
        rows.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current) rows.push(current);
  }
  return rows.length ? rows : ["—"];
}

function section(title: string, body: string[]): PdfLine[] {
  const lines: PdfLine[] = [];
  pushWrapped(lines, title, 13, true, 16);
  let first = true;
  for (const row of body) {
    for (const line of wrap(row, 11, false)) {
      lines.push({ text: line, size: 11, bold: false, gap: first ? 8 : 3 });
      first = false;
    }
  }
  return lines;
}

function pushWrapped(
  lines: PdfLine[],
  text: string,
  size: number,
  bold: boolean,
  firstGap: number,
) {
  wrap(text, size, bold).forEach((line, index) => {
    lines.push({ text: line, size, bold, gap: index === 0 ? firstGap : 2 });
  });
}

function pdfLines(report: IgReportExport): PdfLine[] {
  const text = formatIgReportText(report);
  const [kicker, title, , meta, , ...rest] = text.split("\n");
  const lines: PdfLine[] = [];
  pushWrapped(lines, kicker || "Relatório", 9, false, 0);
  pushWrapped(lines, title || "Skill Instagram", 18, true, 4);
  pushWrapped(lines, meta || "", 10, false, 8);
  let heading = "";
  const bucket: string[] = [];
  function flush() {
    if (!heading) return;
    lines.push(...section(heading, bucket.length ? bucket : ["—"]));
    bucket.length = 0;
  }
  for (const row of rest) {
    if (!row) continue;
    if (
      row === "Overview" ||
      row === "Voz" ||
      row === "Pilares" ||
      row === "Gaps" ||
      row === "Plano" ||
      row === "Ideias"
    ) {
      flush();
      heading = row;
      continue;
    }
    bucket.push(row);
  }
  flush();
  return lines;
}

function paginate(lines: PdfLine[]): string[] {
  const pages: Array<Array<PdfLine & { y: number }>> = [[]];
  let y = PAGE_H - MARGIN_TOP;
  for (const line of lines) {
    const next = y - line.gap - line.size;
    if (next < MARGIN_BOTTOM && pages[pages.length - 1].length) {
      pages.push([]);
      y = PAGE_H - MARGIN_TOP;
    }
    y -= line.gap;
    pages[pages.length - 1].push({ ...line, y });
    y -= line.size + 3;
  }
  return pages.map((page, index) => {
    const cmds = ["BT", "0 0 0 rg"];
    for (const line of page) {
      cmds.push(`${line.bold ? "/F2" : "/F1"} ${line.size} Tf`);
      cmds.push(`1 0 0 1 ${MARGIN_X} ${line.y} Tm`);
      cmds.push(`(${pdfText(line.text)}) Tj`);
    }
    cmds.push("ET");
    if (pages.length > 1) {
      cmds.push("BT", "0.45 0.45 0.45 rg", "/F1 9 Tf");
      cmds.push(`1 0 0 1 ${MARGIN_X} 28 Tm`);
      cmds.push(`(${pdfText(`${index + 1} / ${pages.length}`)}) Tj`);
      cmds.push("ET");
    }
    return cmds.join("\n");
  });
}

export function buildIgReportPdf(report: IgReportExport): Uint8Array {
  const pages = paginate(pdfLines(report));
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  function add(body: string) {
    offsets.push(pdf.length);
    pdf += body.endsWith("\n") ? body : `${body}\n`;
  }

  const pageIds = pages.map((_, index) => 6 + index * 2);
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  add(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
  );
  add(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
  );
  add(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
  );

  pages.forEach((stream, index) => {
    const contentId = 5 + index * 2;
    const pageId = pageIds[index];
    add(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
    add(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`,
    );
  });

  const infoId = 5 + pages.length * 2;
  add(
    `${infoId} 0 obj\n<< /Title (${pdfText("Relatório Skill Instagram")}) /Producer (Namao Studio) >>\nendobj\n`,
  );

  const xrefAt = pdf.length;
  const size = offsets.length;
  let xref = `xref\n0 ${size}\n`;
  xref += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += xref;
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Uint8Array.from(pdf, (char) => char.charCodeAt(0));
}
