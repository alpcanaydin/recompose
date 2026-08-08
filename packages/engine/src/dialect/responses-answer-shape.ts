import type { JsonObject } from '../gateway-wire';
import type { ResponsesResponse } from './responses-wire';

import { isJsonObject } from '../gateway-wire';

export function isResponsesAnswer(value: JsonObject): value is JsonObject & ResponsesResponse {
  return (
    typeof value['id'] === 'string' &&
    (value['status'] === 'completed' ||
      value['status'] === 'incomplete' ||
      value['status'] === 'failed') &&
    Array.isArray(value['output'])
  );
}

export function terminalResponseIn(
  event: JsonObject & { type: string },
): (JsonObject & ResponsesResponse) | null {
  const response = event['response'];

  return isJsonObject(response) && isResponsesAnswer(response) ? response : null;
}
