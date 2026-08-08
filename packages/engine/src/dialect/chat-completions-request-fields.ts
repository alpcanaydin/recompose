import type { ChatCompletionsRequest, ChatSystemMessage } from './chat-completions-wire';
import type { Fate } from './fates';
import type { HubCacheBreakpoint, HubSampling, HubSystemText } from './hub';

import { chatCacheControlFrom } from './chat-completions-cache';
import { chatCompletionsDrops } from './chat-completions-drops';

export { toolChoiceFrom, toolsFrom } from './chat-completions-request-tools';

export const injectedMaxOutputTokensDefault = 4096;

function recordTokenSource(request: ChatCompletionsRequest, fates: Fate[]): void {
  if (request.max_completion_tokens === undefined) {
    fates.push({ field: 'max_tokens', disposition: 'mapped', to: 'sampling.maxOutputTokens' });

    return;
  }

  fates.push({
    field: 'max_completion_tokens',
    disposition: 'mapped',
    to: 'sampling.maxOutputTokens',
  });

  if (request.max_tokens !== undefined) {
    fates.push({ field: 'max_tokens', disposition: 'mapped', to: 'absent' });
  }
}

function maxTokensFrom(request: ChatCompletionsRequest, fates: Fate[]): number {
  const ceiling = request.max_completion_tokens ?? request.max_tokens;

  if (ceiling === undefined) {
    fates.push({
      field: 'max_tokens',
      disposition: 'mapped',
      to: 'sampling.maxOutputTokens (default)',
    });

    return injectedMaxOutputTokensDefault;
  }

  recordTokenSource(request, fates);

  return ceiling;
}

function temperatureInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.temperature === undefined) {
    return sampling;
  }

  const clamped = Math.min(request.temperature, 1);
  const to =
    clamped === request.temperature ? 'sampling.temperature' : 'sampling.temperature (clamped)';

  fates.push({ field: 'temperature', disposition: 'mapped', to });

  return { ...sampling, temperature: clamped };
}

function topPInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.top_p === undefined) {
    return sampling;
  }

  fates.push({ field: 'top_p', disposition: 'mapped', to: 'sampling.topP' });

  return { ...sampling, topP: request.top_p };
}

function stopInto(
  request: ChatCompletionsRequest,
  sampling: HubSampling,
  fates: Fate[],
): HubSampling {
  if (request.stop === undefined) {
    return sampling;
  }

  fates.push({ field: 'stop', disposition: 'mapped', to: 'sampling.stop' });

  return { ...sampling, stop: typeof request.stop === 'string' ? [request.stop] : request.stop };
}

export function samplingFrom(request: ChatCompletionsRequest, fates: Fate[]): HubSampling {
  const base: HubSampling = { maxOutputTokens: maxTokensFrom(request, fates) };
  const withTemperature = temperatureInto(request, base, fates);
  const withTopP = topPInto(request, withTemperature, fates);

  return stopInto(request, withTopP, fates);
}

export function scanDrops(request: ChatCompletionsRequest, fates: Fate[]): void {
  for (const drop of chatCompletionsDrops) {
    if (drop.field in request) {
      fates.push({
        field: drop.field,
        disposition: 'mapped',
        to: 'absent',
        ...(drop.costBearing ? { costBearing: true } : {}),
      });
    }
  }
}

export function scanEnvelope(request: ChatCompletionsRequest, fates: Fate[]): void {
  if (request.model !== undefined) {
    fates.push({ field: 'model', disposition: 'carried' });
  }

  fates.push({ field: 'messages', disposition: 'mapped', to: 'messages' });
}

export function systemFrom(
  texts: readonly string[],
  breakpoint?: HubCacheBreakpoint,
): readonly HubSystemText[] | undefined {
  if (texts.length === 0) {
    return undefined;
  }

  return texts.map((text, index) => ({
    text,
    ...(index === texts.length - 1 && breakpoint !== undefined
      ? { cacheBreakpoint: breakpoint }
      : {}),
  }));
}

export function systemMessageFrom(
  system: readonly HubSystemText[] | undefined,
  fates: Fate[],
): ChatSystemMessage | undefined {
  const carried = carriedSystem(system);

  if (carried === undefined || carried.length === 0) {
    return undefined;
  }

  fates.push({ field: 'system', disposition: 'mapped', to: 'messages[system]' });

  const droppedBreakpoints = carried
    .slice(0, -1)
    .filter((text) => text.cacheBreakpoint !== undefined);

  if (droppedBreakpoints.length > 0) {
    fates.push({
      field: 'system[cacheBreakpoint]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  }

  return {
    role: 'system',
    content: carried.map((text) => text.text).join('\n'),
    ...chatCacheControlFrom(carried.at(-1)?.cacheBreakpoint),
  };
}

function carriedSystem(system: readonly HubSystemText[] | undefined): HubSystemText[] | undefined {
  return system?.filter(
    (part) => part.text !== '' && !part.text.trimStart().startsWith('x-anthropic-billing-header:'),
  );
}
