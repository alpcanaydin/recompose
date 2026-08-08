import type { Crossing } from './gateway-wire';
import type { PluginHeaderMap } from './plugin-wire';

function originalRequest(crossing: Crossing, requestBody: Uint8Array, bodyChanged: boolean) {
  return bodyChanged ? requestBody.slice() : new TextEncoder().encode(JSON.stringify(crossing.raw));
}

export function notePluginExecution(
  crossing: Crossing,
  requestHeaders: PluginHeaderMap,
  requestBody: Uint8Array,
  bodyChanged: boolean,
  skipPluginId = '',
): void {
  crossing.pluginExecution = {
    requestHeaders: structuredClone(requestHeaders),
    originalRequest: originalRequest(crossing, requestBody, bodyChanged),
    requestBody: requestBody.slice(),
    skipPluginId,
  };
}
