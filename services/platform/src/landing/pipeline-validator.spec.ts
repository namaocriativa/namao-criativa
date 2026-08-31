import { buildLeadBrief } from './lead-brief';
import { parseSitePlan } from './pipeline-assembler';
import {
  findInventedContacts,
  mapIssuesToSectionIds,
  validateAssembledFiles,
  validateSectionContent,
} from './pipeline-validator';

describe('pipeline-validator', () => {
  const brief = buildLeadBrief({
    id: 'x',
    name: 'Firma',
    email: 'contato@firma.com',
    images: [{ filename: 'hero.jpg' }],
  });

  it('bloqueia e-mail que não está no brief', () => {
    const issues = findInventedContacts(
      'Fale com fake@inventado.com',
      brief,
    );
    expect(issues.some((issue) => issue.includes('fake@inventado.com'))).toBe(
      true,
    );
  });

  it('permite e-mail e imagem do brief', () => {
    const issues = validateAssembledFiles(
      [
        { path: 'index.html', content: '<script src="/src/main.js"></script>' },
        {
          path: 'src/main.js',
          content: '<a href="mailto:contato@firma.com">e-mail</a><img src="/images/hero.jpg" />',
        },
        { path: 'src/style.css', content: 'body{}' },
        { path: 'README.md', content: 'ok' },
      ],
      brief,
    );
    expect(issues).toEqual([]);
  });

  it('rejeita imagem fora do catálogo', () => {
    const issues = validateAssembledFiles(
      [
        { path: 'index.html', content: '<script src="/src/main.js"></script>' },
        { path: 'src/main.js', content: '<img src="/images/secreta.png" />' },
        { path: 'src/style.css', content: 'body{}' },
        { path: 'README.md', content: 'ok' },
      ],
      brief,
    );
    expect(issues.some((issue) => issue.includes('/images/secreta.png'))).toBe(
      true,
    );
  });

  it('validateSectionContent bloqueia imagem, href e services divergentes', () => {
    const plan = parseSitePlan({}, brief, [
      { id: 'hero', type: 'hero', title: 'Hero', description: '' },
      { id: 'services', type: 'services', title: 'Serviços', description: '' },
      {
        id: 'testimonials',
        type: 'testimonials',
        title: 'Prova',
        description: '',
      },
    ]);
    const heroIssues = validateSectionContent(
      {
        id: 'hero',
        type: 'hero',
        content: {
          imageRefs: ['/images/secreta.png'],
          ctaHref: 'https://wa.me/000',
        },
      },
      brief,
      plan,
    );
    expect(heroIssues.some((issue) => issue.includes('/images/secreta.png'))).toBe(
      true,
    );
    expect(heroIssues.some((issue) => issue.includes('https://wa.me/000'))).toBe(
      true,
    );

    const withServices = buildLeadBrief({
      id: 'x',
      name: 'Firma',
      email: 'contato@firma.com',
      services: ['Consultoria'],
      images: [{ filename: 'hero.jpg' }],
    });
    const serviceIssues = validateSectionContent(
      {
        id: 'services',
        type: 'services',
        content: { items: ['Inventado'] },
      },
      withServices,
      plan,
    );
    expect(serviceIssues.some((issue) => issue.includes('services'))).toBe(true);

    const quoteIssues = validateSectionContent(
      {
        id: 'testimonials',
        type: 'testimonials',
        content: { items: ['"Excelente atendimento" — João'] },
      },
      brief,
      plan,
    );
    expect(quoteIssues.some((issue) => issue.includes('citações'))).toBe(true);
  });

  it('mapeia issues de arquivo para a seção que contém o valor', () => {
    const ids = mapIssuesToSectionIds(
      ['Imagem não permitida: /images/secreta.png'],
      [
        {
          id: 'hero',
          content: { imageRefs: ['/images/secreta.png'] },
        },
      ],
    );
    expect(ids).toEqual(['hero']);
  });
});
