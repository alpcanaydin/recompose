import type { Fate } from './fates';
import type { ResponsesRequest } from './responses-wire';

import { responsesRequestDrops, type ResponsesDrop } from './responses-drops';

const topLevelDestinations: readonly [keyof ResponsesRequest, string][] = [
  ['model', 'routing'],
  ['instructions', 'system'],
  ['tools', 'tools'],
  ['tool_choice', 'toolChoice'],
  ['temperature', 'sampling.temperature'],
  ['top_p', 'sampling.topP'],
  ['max_output_tokens', 'sampling.maxOutputTokens'],
  ['previous_response_id', 'previousResponseId'],
  ['reasoning', 'reasoning'],
  ['modalities', 'responseModalities'],
  ['response_format', 'responseFormat'],
  ['service_tier', 'serviceTier'],
  ['parallel_tool_calls', 'parallelToolCalls'],
];

export function responsesTopLevelFates(request: ResponsesRequest): Fate[] {
  const named: Fate[] = [{ field: 'input', disposition: 'mapped', to: 'messages' }];

  for (const [field, to] of topLevelDestinations) {
    if (field in request) named.push({ field, disposition: 'mapped', to });
  }

  return named;
}

export function responsesDropFates(request: ResponsesRequest): Fate[] {
  return responsesRequestDrops.flatMap((drop) => (drop.field in request ? [dropFateOf(drop)] : []));
}

function dropFateOf(drop: ResponsesDrop): Fate {
  return {
    field: drop.field,
    disposition: 'mapped',
    to: 'absent',
    ...(drop.costBearing ? { costBearing: true } : {}),
  };
}
