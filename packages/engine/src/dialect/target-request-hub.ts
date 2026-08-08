import type { Dialect, TranslationRefusal } from '../refusals';
import type { TranslateResult } from './fates';
import type { HubRequest } from './hub';

import { geminiRequestForAnthropic } from './gemini-anthropic-request';
import {
  omitOrphanToolSettingsForChat,
  orderResponsesToolResultsForChat,
} from './responses-chat-request';

export function requestHubForTarget(
  from: Dialect,
  to: Dialect,
  decoded: TranslateResult<HubRequest, TranslationRefusal>,
): TranslateResult<HubRequest, TranslationRefusal> {
  if ('refusal' in decoded) return decoded;

  switch (`${from}:${to}`) {
    case 'responses:chat-completions':
      return responsesHubForChat(decoded);
    case 'gemini:anthropic':
      return geminiRequestForAnthropic(decoded);
    case 'chat-completions:anthropic':
      return withoutTemperature(decoded);
    default:
      return decoded;
  }
}

function responsesHubForChat(
  decoded: TranslateResult<HubRequest, TranslationRefusal>,
): TranslateResult<HubRequest, TranslationRefusal> {
  if ('refusal' in decoded) return decoded;

  return {
    ...decoded,
    value: omitOrphanToolSettingsForChat({
      ...decoded.value,
      messages: orderResponsesToolResultsForChat(decoded.value.messages),
    }),
  };
}

function withoutTemperature(
  decoded: TranslateResult<HubRequest, TranslationRefusal>,
): TranslateResult<HubRequest, TranslationRefusal> {
  if ('refusal' in decoded) return decoded;

  const sampling = decoded.value.sampling;

  if (sampling?.temperature === undefined) return decoded;

  const { temperature: _temperature, ...withoutTemperatureValue } = sampling;

  return {
    value: { ...decoded.value, sampling: withoutTemperatureValue },
    fates: [...decoded.fates, { field: 'temperature', disposition: 'mapped', to: 'absent' }],
  };
}
