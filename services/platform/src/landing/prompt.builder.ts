export type LeadLike = {
  id?: string | null;
  name?: string | null;
  landingSlug?: string | null;
  category?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  services?: unknown;
  rating?: number | null;
  reviewCount?: number | null;
  images?: Array<{
    filename?: string | null;
    localPath?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
  }>;
};

export function slugifyLeadName(name: unknown): string {
  return (
    String(name || 'lead')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lead'
  );
}

/** Slug estável: reutiliza landingSlug salvo ou `{nome}-{ultimos8DoLeadId}`. */
export function stableLandingSlug(lead: {
  id?: string | null;
  name?: string | null;
  landingSlug?: string | null;
}): string {
  const saved = String(lead.landingSlug || '').trim();
  if (saved) return saved;
  const base = slugifyLeadName(lead.name).slice(0, 50);
  const id = String(lead.id || '');
  const suffix = id.slice(-8) || 'unknown';
  return `${base}-${suffix}`;
}

function valueOrNone(value: unknown): string {
  if (value == null) return 'não encontrado';
  if (Array.isArray(value)) {
    const joined = value.map(String).filter(Boolean).join(', ');
    return joined || 'não encontrado';
  }
  const text = String(value).trim();
  return text || 'não encontrado';
}

function localImagePath(localPath: unknown): string {
  const relative = String(localPath || '').replace(/^\/+/, '');
  if (!relative) return '';
  return relative.startsWith('services/platform/') ? relative : `services/platform/${relative}`;
}

/** Prompt mais longo estilo Cursor Agent (para revisão/cópia humana). */
export function buildCursorLandingPrompt(lead: LeadLike): string {
  const images = lead.images || [];
  const slug = stableLandingSlug(lead);
  const outputDir = `leads/${slug}`;
  const logoCandidates = images.filter((img) =>
    /logo/i.test(`${img.filename || ''} ${img.sourceUrl || ''}`),
  );
  const photoImages = images.filter((img) => !logoCandidates.includes(img));

  const imageLines = images.length
    ? images
        .map((img, index) => {
          const kind = logoCandidates.includes(img)
            ? 'logo/candidato a logo'
            : 'foto/visual';
          const path = localImagePath(img.localPath);
          return [
            `${index + 1}. [${kind}]`,
            `   - caminho local (origem no monorepo): ${path}`,
            `   - copiar para: ${outputDir}/public/images/${img.filename || `image-${String(index + 1).padStart(2, '0')}.jpg`}`,
            `   - origem: ${img.source || 'desconhecida'}`,
          ].join('\n');
        })
        .join('\n')
    : 'Nenhuma imagem disponível para este lead.';

  return `# Tarefa para o Cursor Agent

Crie ou complete um **projeto Vite independente** de landing page para este negócio em \`${outputDir}/\`.

## Regras
- Use APENAS as informações fornecidas. Não invente dados.
- Se um campo estiver como "não encontrado", omita esse elemento.
- CTAs só com contatos existentes.
- Imagens via \`/images/...\` no Vite.

## Negócio
- Lead ID: ${lead.id}
- Nome: ${valueOrNone(lead.name)}
- Slug: ${slug}
- Categoria: ${valueOrNone(lead.category)}
- Descrição: ${valueOrNone(lead.description)}
- Serviços: ${valueOrNone(lead.services)}
- Telefone: ${valueOrNone(lead.phone)}
- WhatsApp: ${valueOrNone(lead.whatsapp)}
- E-mail: ${valueOrNone(lead.email)}
- Website: ${valueOrNone(lead.website)}
- Endereço: ${valueOrNone(lead.address)}
- Cidade/Estado/País: ${valueOrNone(lead.city)} / ${valueOrNone(lead.state)} / ${valueOrNone(lead.country)}
- Coordenadas: ${
    lead.latitude != null && lead.longitude != null
      ? `${lead.latitude}, ${lead.longitude}`
      : 'não encontrado'
  }
- Instagram: ${valueOrNone(lead.instagram)}
- Facebook: ${valueOrNone(lead.facebook)}
- LinkedIn: ${valueOrNone(lead.linkedin)}
- Rating/Reviews: ${valueOrNone(lead.rating)} / ${valueOrNone(lead.reviewCount)}

## Imagens
${imageLines}

Fotos sugeridas:
${
  photoImages.length
    ? photoImages
        .slice(0, 8)
        .map((img) => `- ${localImagePath(img.localPath)}`)
        .join('\n')
    : '- (nenhuma)'
}
`;
}
