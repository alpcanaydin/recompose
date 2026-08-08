import type { TranslationRefusal } from '../refusals';
import type { TranslateResult } from './fates';
import type { HubContentBlock, HubMessage, HubRequest } from './hub';

function mediaText(block: Extract<HubContentBlock, { type: 'audio' | 'video' }>): string {
  return block.source.type === 'url'
    ? block.source.url
    : `data:${block.source.mediaType};base64,${block.source.data}`;
}

function anthropicBlock(block: HubContentBlock): HubContentBlock {
  return block.type === 'audio' || block.type === 'video'
    ? { type: 'text', text: mediaText(block) }
    : block;
}

function anthropicMessage(message: HubMessage): HubMessage {
  return { ...message, content: message.content.map(anthropicBlock) };
}

function systemMessage(system: HubRequest['system']): HubMessage[] {
  if (system === undefined) return [];

  return [
    {
      role: 'user',
      boundary: 'system-reminder',
      content: system.map(({ text }) => ({ type: 'text', text })),
    },
  ];
}

function withoutTemperature(sampling: HubRequest['sampling']): HubRequest['sampling'] {
  if (sampling?.temperature === undefined) return sampling;

  const { temperature: _temperature, ...rest } = sampling;

  return rest;
}

function systemFates(system: HubRequest['system']) {
  return system === undefined
    ? []
    : [{ field: 'systemInstruction', disposition: 'mapped' as const, to: 'messages[user]' }];
}

function temperatureFates(request: HubRequest) {
  return request.sampling?.temperature === undefined
    ? []
    : [{ field: 'temperature', disposition: 'mapped' as const, to: 'absent' }];
}

export function geminiRequestForAnthropic(
  decoded: TranslateResult<HubRequest, TranslationRefusal>,
): TranslateResult<HubRequest, TranslationRefusal> {
  if ('refusal' in decoded) return decoded;

  const { system, ...request } = decoded.value;
  const sampling = withoutTemperature(request.sampling);

  return {
    value: {
      ...request,
      messages: [...systemMessage(system), ...request.messages.map(anthropicMessage)],
      ...(sampling === undefined ? {} : { sampling }),
    },
    fates: [...decoded.fates, ...systemFates(system), ...temperatureFates(decoded.value)],
  };
}
