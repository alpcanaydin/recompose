/**
 * Every vendor recompose draws a mark for, across all four destinations.
 *
 * @summary Reach for it where a surface walks the whole set rather than naming one vendor. A mark
 * standing here is a mark recompose can draw, never a claim that the vendor can be connected.
 */
export const brandMarkNames = [
  'anthropic',
  'cerebras',
  'deepinfra',
  'deepseek',
  'fireworks',
  'gemini',
  'githubCopilot',
  'grok',
  'groq',
  'kimi',
  'lmstudio',
  'minimax',
  'mistral',
  'moonshot',
  'ollama',
  'openai',
  'openrouter',
  'qwen',
  'together',
  'vllm',
  'zhipu',
] as const;

export type BrandMarkName = (typeof brandMarkNames)[number];

/** Which of a vendor's two drawings a surface asks for. */
export type BrandMarkVariant = 'color' | 'mono';
