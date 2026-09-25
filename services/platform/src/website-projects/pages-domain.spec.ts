import {
  domainPlan,
  extraHostnames,
  parseWebsiteDomain,
  syncPagesProjectDomains,
  type PagesDomainApi,
} from './pages-domain';

describe('parseWebsiteDomain', () => {
  it('aceita apex e tira protocolo, www e path', () => {
    expect(parseWebsiteDomain('https://www.Paulinhocabelos.com.br/foo')).toEqual(
      { domain: 'paulinhocabelos.com.br', invalid: false },
    );
    expect(parseWebsiteDomain('  ')).toEqual({ domain: null, invalid: false });
    expect(parseWebsiteDomain(null)).toEqual({ domain: null, invalid: false });
  });

  it('rejeita valor que não é hostname', () => {
    expect(parseWebsiteDomain('não é domínio')).toEqual({
      domain: null,
      invalid: true,
    });
    expect(parseWebsiteDomain(12)).toEqual({ domain: null, invalid: true });
  });
});

describe('extraHostnames / domainPlan', () => {
  it('gera apex + www', () => {
    expect(extraHostnames('paulinhocabelos.com.br')).toEqual([
      'paulinhocabelos.com.br',
      'www.paulinhocabelos.com.br',
    ]);
  });

  it('anexa o novo e remove só o antigo', () => {
    expect(
      domainPlan('antigo.com.br', 'paulinhocabelos.com.br'),
    ).toEqual({
      attach: ['paulinhocabelos.com.br', 'www.paulinhocabelos.com.br'],
      detach: ['antigo.com.br', 'www.antigo.com.br'],
    });
  });

  it('não mexe em hostnames iguais', () => {
    expect(domainPlan('loja.com.br', 'https://loja.com.br')).toEqual({
      attach: [],
      detach: [],
    });
  });
});

describe('syncPagesProjectDomains', () => {
  function fakeApi(existing: string[]): PagesDomainApi & {
    attached: string[];
    detached: string[];
    cnames: string[];
  } {
    const have = new Set(existing);
    const attached: string[] = [];
    const detached: string[] = [];
    const cnames: string[] = [];
    return {
      attached,
      detached,
      cnames,
      async listDomains() {
        return [...have];
      },
      async attachDomain(_project, hostname) {
        have.add(hostname);
        attached.push(hostname);
      },
      async detachDomain(_project, hostname) {
        have.delete(hostname);
        detached.push(hostname);
      },
      async ensureCname(hostname) {
        cnames.push(hostname);
      },
    };
  }

  it('anexa apex+www e CNAME quando o projeto ainda não tem o domínio', async () => {
    const api = fakeApi([]);
    const result = await syncPagesProjectDomains({
      api,
      project: 'paulinhocabelos',
      next: 'paulinhocabelos.com.br',
    });
    expect(result.attached).toEqual([
      'paulinhocabelos.com.br',
      'www.paulinhocabelos.com.br',
    ]);
    expect(result.detached).toEqual([]);
    expect(api.cnames).toEqual(result.attached);
  });

  it('remove só os hostnames do domínio anterior', async () => {
    const api = fakeApi([
      'antigo.com.br',
      'www.antigo.com.br',
      'outro-cliente.com.br',
    ]);
    const result = await syncPagesProjectDomains({
      api,
      project: 'loja',
      previous: 'antigo.com.br',
      next: 'novo.com.br',
    });
    expect(result.detached).toEqual(['antigo.com.br', 'www.antigo.com.br']);
    expect(api.detached).toEqual(['antigo.com.br', 'www.antigo.com.br']);
    expect(result.attached).toEqual(['novo.com.br', 'www.novo.com.br']);
  });

  it('é idempotente se o domínio já está no Pages', async () => {
    const api = fakeApi(['loja.com.br', 'www.loja.com.br']);
    const result = await syncPagesProjectDomains({
      api,
      project: 'loja',
      next: 'loja.com.br',
      previous: 'loja.com.br',
    });
    expect(result.attached).toEqual([]);
    expect(result.detached).toEqual([]);
    expect(api.cnames).toEqual(['loja.com.br', 'www.loja.com.br']);
  });

  it('só faz detach quando o domínio é limpo', async () => {
    const api = fakeApi(['loja.com.br', 'www.loja.com.br']);
    const result = await syncPagesProjectDomains({
      api,
      project: 'loja',
      previous: 'loja.com.br',
      next: null,
    });
    expect(result.attached).toEqual([]);
    expect(result.detached).toEqual(['loja.com.br', 'www.loja.com.br']);
  });
});
