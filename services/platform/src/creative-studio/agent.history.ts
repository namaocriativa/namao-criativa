import { MESSAGE_KIND, PROPOSAL_STATUS } from './agent.constants';
import type { StoredAgentMessage } from './agent.types';
import type { GeminiTurnContent } from '../llm/gemini-turn';
import { parseArgs } from '../llm/gemini-turn';

export function agentContentsFromMessages(
  messages: StoredAgentMessage[],
): GeminiTurnContent[] {
  const contents: GeminiTurnContent[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (message.kind === MESSAGE_KIND.TOOL) {
      const tools: StoredAgentMessage[] = [];
      while (index < messages.length && messages[index].kind === MESSAGE_KIND.TOOL) {
        tools.push(messages[index]);
        index += 1;
      }
      contents.push({
        role: 'model',
        parts: tools.map((tool) => ({
          functionCall: {
            name: tool.toolName || 'tool',
            args: toolArgs(tool),
          },
        })),
      });
      contents.push({
        role: 'user',
        parts: tools.map((tool) => ({
          functionResponse: {
            name: tool.toolName || 'tool',
            response: asRecord(toolResult(tool)),
          },
        })),
      });
      continue;
    }

    if (message.kind === MESSAGE_KIND.GENERATION) {
      index += 1;
      continue;
    }

    if (message.kind === MESSAGE_KIND.PROPOSAL) {
      const spec = asRecord(message.settings);
      const prompt = String(spec.prompt || message.text || '').trim();
      if (message.status === PROPOSAL_STATUS.PENDING && prompt) {
        contents.push({
          role: 'model',
          parts: [
            {
              text: `Há uma proposta pendente de confirmação do usuário: ${prompt}`,
            },
          ],
        });
      } else if (message.status === PROPOSAL_STATUS.CONFIRMED && prompt) {
        contents.push({
          role: 'model',
          parts: [
            {
              text: `O usuário confirmou e a geração rodou com o prompt: ${prompt}`,
            },
          ],
        });
      }
      index += 1;
      continue;
    }

    const text = String(message.text || '').trim();
    if (text) {
      contents.push({
        role: message.role === 'user' ? 'user' : 'model',
        parts: [{ text }],
      });
    }
    index += 1;
  }

  return contents.filter((content) => content.parts.length > 0);
}

function toolArgs(message: StoredAgentMessage): Record<string, unknown> {
  const payload = asRecord(message.toolPayload);
  return parseArgs(payload.args);
}

function toolResult(message: StoredAgentMessage): unknown {
  const payload = asRecord(message.toolPayload);
  return payload.result ?? payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
