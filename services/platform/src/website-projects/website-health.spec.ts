import { buildWebsiteHealth, summarizeHealth } from './website-health';

describe('buildWebsiteHealth', () => {
  it('fica idle sem projeto', () => {
    const health = buildWebsiteHealth({
      project: null,
      deployType: null,
      domain: null,
      pagesLive: null,
      attached: [],
      hosts: [],
    });
    expect(health.overall).toBe('idle');
    expect(health.items).toEqual([]);
  });

  it('marca ok quando Pages e domínio respondem', () => {
    const health = buildWebsiteHealth({
      project: 'paulinhocabelos',
      deployType: 'cloudflare',
      domain: 'paulinhocabelos.com.br',
      pagesLive: { ok: true, status: 200, detail: 'HTTP 200' },
      attached: [
        { name: 'paulinhocabelos.com.br', status: 'active' },
        { name: 'www.paulinhocabelos.com.br', status: 'active' },
      ],
      hosts: [
        {
          host: 'paulinhocabelos.com.br',
          addresses: ['1.1.1.1'],
          http: { ok: true, status: 200, detail: 'HTTP 200' },
          attached: { name: 'paulinhocabelos.com.br', status: 'active' },
        },
        {
          host: 'www.paulinhocabelos.com.br',
          addresses: ['1.1.1.1'],
          http: { ok: true, status: 200, detail: 'HTTP 200' },
          attached: { name: 'www.paulinhocabelos.com.br', status: 'active' },
        },
      ],
    });
    expect(health.pagesDev).toBe('paulinhocabelos.pages.dev');
    expect(health.overall).toBe('ok');
    expect(health.items).toHaveLength(3);
  });

  it('avisa quando só o www responde', () => {
    const health = buildWebsiteHealth({
      project: 'paulinhocabelos',
      deployType: 'cloudflare',
      domain: 'paulinhocabelos.com.br',
      pagesLive: { ok: true, status: 200, detail: 'HTTP 200' },
      attached: [],
      hosts: [
        {
          host: 'paulinhocabelos.com.br',
          addresses: [],
          http: { ok: false, detail: 'sem DNS público' },
          attached: { name: 'paulinhocabelos.com.br', status: 'active' },
        },
        {
          host: 'www.paulinhocabelos.com.br',
          addresses: ['1.1.1.1'],
          http: { ok: true, status: 200, detail: 'HTTP 200' },
          attached: { name: 'www.paulinhocabelos.com.br', status: 'active' },
        },
      ],
    });
    expect(health.overall).toBe('warn');
    expect(health.items.find((item) => item.id === 'host:paulinhocabelos.com.br')?.status).toBe(
      'down',
    );
    expect(health.summary).toContain('www.paulinhocabelos.com.br');
  });
});

describe('summarizeHealth', () => {
  it('diz que o Pages está no ar sem domínio', () => {
    expect(
      summarizeHealth(
        [
          {
            id: 'pages-dev',
            label: 'loja.pages.dev',
            status: 'ok',
            detail: 'No ar',
          },
        ],
        false,
      ),
    ).toEqual({ overall: 'ok', summary: 'Site no ar no Pages.' });
  });
});
