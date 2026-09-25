import { parseGithubRepo } from './github-repo';

describe('parseGithubRepo', () => {
  it('aceita owner/name', () => {
    expect(parseGithubRepo('lleonesouza/paulinhocabelos')).toEqual({
      owner: 'lleonesouza',
      name: 'paulinhocabelos',
      fullName: 'lleonesouza/paulinhocabelos',
    });
  });

  it('aceita URL do GitHub', () => {
    expect(
      parseGithubRepo('https://github.com/lleonesouza/paulinhocabelos.git'),
    ).toEqual({
      owner: 'lleonesouza',
      name: 'paulinhocabelos',
      fullName: 'lleonesouza/paulinhocabelos',
    });
  });

  it('rejeita valor inválido', () => {
    expect(parseGithubRepo('paulinhocabelos')).toBeNull();
    expect(parseGithubRepo('')).toBeNull();
    expect(parseGithubRepo(null)).toBeNull();
  });
});
