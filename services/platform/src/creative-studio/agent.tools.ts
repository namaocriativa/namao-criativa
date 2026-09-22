import {
  CREATIVE_AGENT_KIND,
  PROPOSE_IMAGE_TOOL,
  PROPOSE_VIDEO_TOOL,
  type CreativeAgentKind,
} from './agent.constants';
import type { CreativeToolDefinition } from './agent.types';

const STRING = { type: 'string' };

export const CREATIVE_TOOLS: CreativeToolDefinition[] = [
  {
    name: 'search_leads',
    description:
      'Busca leads visíveis ao usuário por nome, nicho ou cidade. Use antes de montar uma peça personalizada.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        query: {
          ...STRING,
          description: 'Trecho de nome, categoria ou cidade. Vazio lista os mais recentes.',
        },
      },
    },
  },
  {
    name: 'get_lead',
    description:
      'Abre a ficha resumida de um lead: nicho, cidade, contatos e fotos disponíveis.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        leadId: { ...STRING, description: 'ID do lead' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'list_lead_images',
    description:
      'Lista fotos do lead (sem logos) para usar como referência na geração.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        leadId: { ...STRING, description: 'ID do lead' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'list_packages',
    description: 'Lista pacotes da agência (nome, preço, resumo) para ofertas.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        query: { ...STRING, description: 'Filtro opcional pelo nome' },
      },
    },
  },
  {
    name: 'list_characters',
    description:
      'Lista personagens da biblioteca criativa (nome, aparência e quantidade de mídias).',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        query: {
          ...STRING,
          description: 'Filtro opcional pelo nome ou aparência',
        },
      },
    },
  },
  {
    name: 'get_character',
    description:
      'Abre a ficha de um personagem: aparência, identidade e mídias da biblioteca.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        characterId: { ...STRING, description: 'ID do personagem' },
      },
      required: ['characterId'],
    },
  },
  {
    name: 'list_conversation_assets',
    description: 'Lista mídias já salvas nesta conversa.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE, CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        kind: {
          ...STRING,
          description: 'generated, reference, first-frame ou last-frame',
        },
      },
    },
  },
  {
    name: 'list_image_library',
    description:
      'Lista imagens geradas em outras conversas de imagem para usar como quadro inicial de vídeo.',
    kinds: [CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: PROPOSE_IMAGE_TOOL,
    description:
      'Propõe uma geração de imagem para o usuário confirmar. Nunca gere a imagem você mesmo.',
    kinds: [CREATIVE_AGENT_KIND.IMAGE],
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          ...STRING,
          description: 'Prompt completo que será enviado ao modelo de imagem',
        },
        model: STRING,
        aspectRatio: STRING,
        imageSize: STRING,
        temperature: { type: 'number' },
        systemInstruction: STRING,
        googleSearch: { type: 'boolean' },
        referenceAssetIds: {
          type: 'array',
          items: STRING,
          description: 'IDs de ImageAsset desta conversa',
        },
        leadId: STRING,
        leadLabel: STRING,
        leadImageIds: {
          type: 'array',
          items: STRING,
          description: 'IDs de fotos do lead para copiar como referência',
        },
        characterId: {
          ...STRING,
          description:
            'ID de um personagem da biblioteca para travar identidade (ficha + fotos)',
        },
        rationale: {
          ...STRING,
          description: 'Por que esta geração e o que cada referência faz',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: PROPOSE_VIDEO_TOOL,
    description:
      'Propõe uma geração de vídeo para o usuário confirmar. Nunca gere o vídeo você mesmo.',
    kinds: [CREATIVE_AGENT_KIND.VIDEO],
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          ...STRING,
          description: 'Prompt completo que será enviado ao modelo de vídeo',
        },
        model: STRING,
        aspectRatio: STRING,
        duration: STRING,
        resolution: STRING,
        thinkingLevel: STRING,
        firstFrameImageAssetId: {
          ...STRING,
          description: 'ImageAsset de outra conversa de imagem',
        },
        lastFrameImageAssetId: STRING,
        firstFrameAssetId: {
          ...STRING,
          description: 'VideoAsset desta conversa (quadro inicial)',
        },
        lastFrameAssetId: STRING,
        leadId: STRING,
        leadLabel: STRING,
        leadImageIds: {
          type: 'array',
          items: STRING,
        },
        characterId: {
          ...STRING,
          description:
            'ID de um personagem da biblioteca para usar a ficha como quadro inicial',
        },
        rationale: STRING,
      },
      required: ['prompt'],
    },
  },
];

export function toolsForKind(kind: CreativeAgentKind): CreativeToolDefinition[] {
  return CREATIVE_TOOLS.filter((tool) => tool.kinds.includes(kind));
}

export function findCreativeTool(
  name: string,
  kind?: CreativeAgentKind,
): CreativeToolDefinition | undefined {
  return CREATIVE_TOOLS.find((tool) => {
    if (tool.name !== name) return false;
    if (!kind) return true;
    return tool.kinds.includes(kind);
  });
}

export function geminiToolDeclarations(kind: CreativeAgentKind) {
  return toolsForKind(kind).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
