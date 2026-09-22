import { uniquePlatforms, recomputePostStatus } from './calendar.platforms';

describe('calendar platforms', () => {
  it('deduplica plataformas válidas', () => {
    expect(uniquePlatforms(['instagram', 'instagram', 'youtube', 'foo'])).toEqual(
      ['instagram', 'youtube'],
    );
  });

  it('recomputa status do post a partir dos alvos', () => {
    expect(recomputePostStatus([{ status: 'published' }, { status: 'published' }])).toBe(
      'published',
    );
    expect(recomputePostStatus([{ status: 'published' }, { status: 'ready_manual' }])).toBe(
      'partial',
    );
    expect(recomputePostStatus([{ status: 'failed' }, { status: 'failed' }])).toBe(
      'failed',
    );
    expect(recomputePostStatus([{ status: 'pending' }])).toBe('scheduled');
  });
});
