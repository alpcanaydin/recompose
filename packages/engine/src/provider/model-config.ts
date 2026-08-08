import type { ModelThinking, ProviderModelMetadata } from './model-metadata';

import { cloneModelMetadata, staticModelMetadata } from './model-metadata';
import { reasoningModelBase } from './reasoning-capabilities';

type ThinkingState = {
  dynamicAllowed: boolean;
  levels: string[];
  seen: Set<string>;
  zeroAllowed: boolean;
};

function addLevel(state: ThinkingState, raw: string): void {
  const level = raw.trim().toLowerCase();

  if (level === '') return;
  if (level === 'none') state.zeroAllowed = true;
  if (level === 'auto') state.dynamicAllowed = true;
  if (state.seen.has(level)) return;

  state.seen.add(level);
  state.levels.push(level);
}

function derivedFlags(state: ThinkingState): Partial<ModelThinking> {
  return {
    ...(state.zeroAllowed ? { zeroAllowed: true } : {}),
    ...(state.dynamicAllowed ? { dynamicAllowed: true } : {}),
  };
}

export function normalizeModelThinking(thinking: ModelThinking): ModelThinking {
  const state: ThinkingState = {
    dynamicAllowed: thinking.dynamicAllowed === true,
    levels: [],
    seen: new Set(),
    zeroAllowed: thinking.zeroAllowed === true,
  };

  for (const raw of thinking.levels) {
    addLevel(state, raw);
  }

  return {
    ...thinking,
    levels: state.levels,
    ...derivedFlags(state),
  };
}

export function resolveConfiguredModelMetadata(
  name: string,
  provider: string,
  thinking?: ModelThinking,
): ProviderModelMetadata {
  const id = name.trim();
  const inherited = staticModelMetadata(reasoningModelBase(id));
  const base = inherited ?? { id, provider: provider.trim().toLowerCase() };
  const resolved = {
    ...base,
    id,
    provider: provider.trim().toLowerCase(),
    userDefined: false,
    ...(thinking === undefined ? {} : { thinking: normalizeModelThinking(thinking) }),
  };

  return cloneModelMetadata(resolved);
}
