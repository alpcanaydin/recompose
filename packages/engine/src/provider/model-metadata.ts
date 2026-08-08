export type ModelThinking = {
  levels: readonly string[];
  zeroAllowed?: boolean;
  dynamicAllowed?: boolean;
  minBudget?: number;
  maxBudget?: number;
};

export type ProviderModelMetadata = {
  id: string;
  provider: string;
  displayName?: string;
  description?: string;
  contextLength?: number;
  maxContextLength?: number;
  maxCompletionTokens?: number;
  supportedParameters?: readonly string[];
  thinking?: ModelThinking;
  headers?: Readonly<Record<string, string>>;
  userDefined?: boolean;
};

const CLAUDE_OPUS_4_6: ProviderModelMetadata = {
  id: 'claude-opus-4-6',
  provider: 'anthropic',
  thinking: {
    levels: ['low', 'medium', 'high', 'max'],
    zeroAllowed: true,
    dynamicAllowed: true,
  },
};

export const CLAUDE_SONNET_5: ProviderModelMetadata = {
  id: 'claude-sonnet-5',
  provider: 'anthropic',
  displayName: 'Claude Sonnet 5',
  contextLength: 1_000_000,
  maxContextLength: 1_000_000,
  maxCompletionTokens: 128_000,
  thinking: {
    levels: ['low', 'medium', 'high', 'xhigh', 'max'],
    zeroAllowed: true,
    dynamicAllowed: true,
  },
};

const staticModels = new Map([CLAUDE_OPUS_4_6, CLAUDE_SONNET_5].map((model) => [model.id, model]));

export function staticModelMetadata(model: string): ProviderModelMetadata | undefined {
  const metadata = staticModels.get(model.trim().toLowerCase());

  return metadata === undefined ? undefined : cloneModelMetadata(metadata);
}

const modelHeaders = new Map<string, Readonly<Record<string, string>>>([
  [
    'gpt-5.6-luna',
    {
      'user-agent':
        'codex-tui/0.144.0 (Mac OS 26.5.1; arm64) iTerm.app/3.6.11 (codex-tui; 0.144.0)',
    },
  ],
]);

export function modelOverrideHeaders(model: string): Readonly<Record<string, string>> | undefined {
  const headers = modelHeaders.get(model);

  return headers === undefined ? undefined : { ...headers };
}

export const xaiBuiltinVideoModels = [
  'grok-imagine-video',
  'grok-imagine-video-1.5',
  'grok-imagine-video-1.5-preview',
] as const;

export function cloneModelMetadata(model: ProviderModelMetadata): ProviderModelMetadata {
  return {
    ...model,
    ...(model.supportedParameters === undefined
      ? {}
      : { supportedParameters: [...model.supportedParameters] }),
    ...(model.thinking === undefined
      ? {}
      : { thinking: { ...model.thinking, levels: [...model.thinking.levels] } }),
    ...(model.headers === undefined ? {} : { headers: { ...model.headers } }),
  };
}
