import {
  findWebsiteProject,
  isWebsiteDeployType,
  parseWebsiteCatalog,
} from './website-catalog';

const sample = {
  projects: [
    {
      id: 'paulinhocabelos',
      title: 'Paulinho Cabelos',
      dir: 'paulinhocabelos',
      repo: 'https://github.com/lleonesouza/paulinhocabelos',
      framework: 'next',
      cloudflareProjectName: 'paulinhocabelos',
      vercelProjectName: 'paulinhocabelos',
    },
    {
      id: 'skip-me',
      title: 'Sem repo',
      framework: 'next',
    },
    {
      id: 'bad-framework',
      repo: 'https://github.com/x/y',
      framework: 'wordpress',
    },
  ],
};

describe('website-catalog', () => {
  it('aceita só projetos com id, repo e framework válido', () => {
    const projects = parseWebsiteCatalog(sample);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: 'paulinhocabelos',
      title: 'Paulinho Cabelos',
      framework: 'next',
      repo: 'https://github.com/lleonesouza/paulinhocabelos',
    });
  });

  it('encontra o projeto pelo id', () => {
    const projects = parseWebsiteCatalog(sample);
    expect(findWebsiteProject('paulinhocabelos', projects)?.title).toBe(
      'Paulinho Cabelos',
    );
    expect(findWebsiteProject('missing', projects)).toBeUndefined();
  });

  it('aceita id owner/name sem pasta local', () => {
    const projects = parseWebsiteCatalog({
      projects: [
        {
          id: 'lleonesouza/paulinhocabelos',
          title: 'paulinhocabelos',
          repo: 'https://github.com/lleonesouza/paulinhocabelos',
          framework: 'next',
        },
      ],
    });
    expect(projects).toHaveLength(1);
    expect(projects[0]?.id).toBe('lleonesouza/paulinhocabelos');
    expect(projects[0]?.dir).toBe('lleonesouza/paulinhocabelos');
  });

  it('reconhece o tipo de deploy', () => {
    expect(isWebsiteDeployType('cloudflare')).toBe(true);
    expect(isWebsiteDeployType('vercel')).toBe(true);
    expect(isWebsiteDeployType('netlify')).toBe(false);
  });
});
