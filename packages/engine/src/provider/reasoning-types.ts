export type ReasoningDialect =
  | 'anthropic'
  | 'chat-completions'
  | 'gemini'
  | 'interactions'
  | 'responses';

export type ReasoningIntent =
  | { kind: 'auto' }
  | { kind: 'budget'; budget: number }
  | { kind: 'level'; level: string }
  | { kind: 'none' };
