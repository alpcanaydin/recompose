import type { GeminiRequest } from './gemini-wire';
import type { HubReasoning, HubRequest, HubSampling, HubToolChoice } from './hub';

function basicToolChoice(mode: 'AUTO' | 'ANY' | 'NONE'): HubToolChoice | undefined {
  if (mode === 'AUTO') return { type: 'auto' };
  if (mode === 'NONE') return { type: 'none' };

  return undefined;
}

function requiredToolChoice(names: readonly string[] | undefined): HubToolChoice {
  const [name, ...rest] = names ?? [];

  return name !== undefined && rest.length === 0 ? { type: 'tool', name } : { type: 'required' };
}

function toolChoiceOf(request: GeminiRequest): HubToolChoice | undefined {
  const config = request.toolConfig?.functionCallingConfig;

  return config === undefined
    ? undefined
    : (basicToolChoice(config.mode) ?? requiredToolChoice(config.allowedFunctionNames));
}

function samplingOf(request: GeminiRequest): HubSampling | undefined {
  const config = request.generationConfig;

  if (config === undefined) return undefined;

  const sampling: HubSampling = {
    ...maxTokensField(config.maxOutputTokens),
    ...temperatureField(config.temperature),
    ...topPField(config.topP),
    ...stopsField(config.stopSequences),
  };

  return Object.keys(sampling).length === 0 ? undefined : sampling;
}

function maxTokensField(value: number | undefined): Pick<HubSampling, 'maxOutputTokens'> | object {
  return value === undefined ? {} : { maxOutputTokens: value };
}

function temperatureField(value: number | undefined): Pick<HubSampling, 'temperature'> | object {
  return value === undefined ? {} : { temperature: value };
}

function topPField(value: number | undefined): Pick<HubSampling, 'topP'> | object {
  return value === undefined ? {} : { topP: value };
}

function stopsField(value: readonly string[] | undefined): Pick<HubSampling, 'stop'> | object {
  return value === undefined ? {} : { stop: value };
}

function reasoningOf(request: GeminiRequest): HubReasoning | undefined {
  const thinking = request.generationConfig?.thinkingConfig;

  if (thinking === undefined) return undefined;

  return {
    ...effortField(thinking.thinkingLevel),
    ...budgetField(thinking.thinkingBudget),
    ...summaryField(thinking.includeThoughts),
  };
}

function effortField(value: string | undefined): Pick<HubReasoning, 'effort'> | object {
  return value === undefined ? {} : { effort: value };
}

function budgetField(value: number | undefined): Pick<HubReasoning, 'budgetTokens'> | object {
  return value === undefined ? {} : { budgetTokens: value };
}

function summaryField(value: boolean | undefined): Pick<HubReasoning, 'summary'> | object {
  return value === undefined ? {} : { summary: value ? 'auto' : 'none' };
}

function systemOf(request: GeminiRequest): HubRequest['system'] {
  const texts = request.systemInstruction?.parts.flatMap((part) =>
    part.text === undefined ? [] : [part.text],
  );

  return texts === undefined || texts.length === 0 ? undefined : [{ text: texts.join('\n') }];
}

function systemField(system: HubRequest['system']): Pick<HubRequest, 'system'> | object {
  return system === undefined ? {} : { system };
}

function toolChoiceField(
  toolChoice: HubRequest['toolChoice'],
): Pick<HubRequest, 'toolChoice'> | object {
  return toolChoice === undefined ? {} : { toolChoice };
}

function samplingField(sampling: HubRequest['sampling']): Pick<HubRequest, 'sampling'> | object {
  return sampling === undefined ? {} : { sampling };
}

function reasoningField(
  reasoning: HubRequest['reasoning'],
): Pick<HubRequest, 'reasoning'> | object {
  return reasoning === undefined ? {} : { reasoning };
}

export function geminiRequestOptions(request: GeminiRequest): Partial<HubRequest> {
  return {
    ...systemField(systemOf(request)),
    ...toolChoiceField(toolChoiceOf(request)),
    ...samplingField(samplingOf(request)),
    ...reasoningField(reasoningOf(request)),
  };
}
