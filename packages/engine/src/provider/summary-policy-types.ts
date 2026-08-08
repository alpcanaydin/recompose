type SummaryMode = 'disabled' | 'enabled' | 'unspecified';

export type SummaryConfig = {
  detail?: string;
  mode: SummaryMode;
};

export type SummaryFormat =
  | 'anthropic'
  | 'antigravity'
  | 'chat-completions'
  | 'gemini'
  | 'interactions'
  | 'responses';

export type SummaryPolicyOptions = {
  inferredClaudeThinking?: boolean;
  model?: string;
  provider?: string;
};
