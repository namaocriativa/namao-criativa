import { agentContentsFromMessages } from './agent.history';
import { MESSAGE_KIND, PROPOSAL_STATUS } from './agent.constants';

describe('agentContentsFromMessages', () => {
  it('ignora gerações e reconstrói tools', () => {
    const contents = agentContentsFromMessages([
      {
        id: '1',
        role: 'user',
        kind: MESSAGE_KIND.CHAT,
        text: 'oi',
      },
      {
        id: '2',
        role: 'tool',
        kind: MESSAGE_KIND.TOOL,
        toolName: 'search_leads',
        toolPayload: { args: { query: 'x' }, result: { leads: [] } },
      },
      {
        id: '3',
        role: 'user',
        kind: MESSAGE_KIND.GENERATION,
        text: 'prompt cru',
      },
      {
        id: '4',
        role: 'assistant',
        kind: MESSAGE_KIND.PROPOSAL,
        status: PROPOSAL_STATUS.PENDING,
        text: 'flyer',
        settings: { prompt: 'flyer' },
      },
    ]);
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'oi' }] });
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts[0]).toEqual({
      functionCall: { name: 'search_leads', args: { query: 'x' } },
    });
    expect(contents.some((item) => JSON.stringify(item).includes('prompt cru'))).toBe(
      false,
    );
    expect(JSON.stringify(contents)).toContain('proposta pendente');
  });
});
