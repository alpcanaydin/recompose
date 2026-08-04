import type { IconType } from '@lobehub/icons/es/types';

import AnthropicMono from '@lobehub/icons/es/Anthropic/components/Mono';
import CerebrasColor from '@lobehub/icons/es/Cerebras/components/Color';
import CerebrasMono from '@lobehub/icons/es/Cerebras/components/Mono';
import DeepInfraColor from '@lobehub/icons/es/DeepInfra/components/Color';
import DeepInfraMono from '@lobehub/icons/es/DeepInfra/components/Mono';
import DeepSeekColor from '@lobehub/icons/es/DeepSeek/components/Color';
import DeepSeekMono from '@lobehub/icons/es/DeepSeek/components/Mono';
import FireworksColor from '@lobehub/icons/es/Fireworks/components/Color';
import FireworksMono from '@lobehub/icons/es/Fireworks/components/Mono';
import GeminiColor from '@lobehub/icons/es/Gemini/components/Color';
import GeminiMono from '@lobehub/icons/es/Gemini/components/Mono';
import GithubCopilotMono from '@lobehub/icons/es/GithubCopilot/components/Mono';
import GrokMono from '@lobehub/icons/es/Grok/components/Mono';
import GroqMono from '@lobehub/icons/es/Groq/components/Mono';
import KimiColor from '@lobehub/icons/es/Kimi/components/Color';
import KimiMono from '@lobehub/icons/es/Kimi/components/Mono';
import LmStudioMono from '@lobehub/icons/es/LmStudio/components/Mono';
import MinimaxColor from '@lobehub/icons/es/Minimax/components/Color';
import MinimaxMono from '@lobehub/icons/es/Minimax/components/Mono';
import MistralColor from '@lobehub/icons/es/Mistral/components/Color';
import MistralMono from '@lobehub/icons/es/Mistral/components/Mono';
import MoonshotMono from '@lobehub/icons/es/Moonshot/components/Mono';
import OllamaMono from '@lobehub/icons/es/Ollama/components/Mono';
import OpenAIMono from '@lobehub/icons/es/OpenAI/components/Mono';
import OpenRouterColor from '@lobehub/icons/es/OpenRouter/components/Color';
import OpenRouterMono from '@lobehub/icons/es/OpenRouter/components/Mono';
import QwenColor from '@lobehub/icons/es/Qwen/components/Color';
import QwenMono from '@lobehub/icons/es/Qwen/components/Mono';
import TogetherColor from '@lobehub/icons/es/Together/components/Color';
import TogetherMono from '@lobehub/icons/es/Together/components/Mono';
import VllmColor from '@lobehub/icons/es/Vllm/components/Color';
import VllmMono from '@lobehub/icons/es/Vllm/components/Mono';
import ZhipuColor from '@lobehub/icons/es/Zhipu/components/Color';
import ZhipuMono from '@lobehub/icons/es/Zhipu/components/Mono';

import type { BrandMarkName, BrandMarkVariant } from './brand-mark-inventory';

type MarkDrawing = Record<BrandMarkVariant, IconType>;

/**
 * The drawing of a vendor whose logo carries no colors of its own.
 *
 * @summary Its one mark answers both variants, because taking the ink around it is how the vendor
 * draws it, not a stand-in for a color version that exists somewhere.
 */
function inOneColorOnly(drawing: IconType): MarkDrawing {
  return { color: drawing, mono: drawing };
}

const marks = {
  anthropic: inOneColorOnly(AnthropicMono),
  cerebras: { color: CerebrasColor, mono: CerebrasMono },
  deepinfra: { color: DeepInfraColor, mono: DeepInfraMono },
  deepseek: { color: DeepSeekColor, mono: DeepSeekMono },
  fireworks: { color: FireworksColor, mono: FireworksMono },
  gemini: { color: GeminiColor, mono: GeminiMono },
  githubCopilot: inOneColorOnly(GithubCopilotMono),
  grok: inOneColorOnly(GrokMono),
  groq: inOneColorOnly(GroqMono),
  kimi: { color: KimiColor, mono: KimiMono },
  lmstudio: inOneColorOnly(LmStudioMono),
  minimax: { color: MinimaxColor, mono: MinimaxMono },
  mistral: { color: MistralColor, mono: MistralMono },
  moonshot: inOneColorOnly(MoonshotMono),
  ollama: inOneColorOnly(OllamaMono),
  openai: inOneColorOnly(OpenAIMono),
  openrouter: { color: OpenRouterColor, mono: OpenRouterMono },
  qwen: { color: QwenColor, mono: QwenMono },
  together: { color: TogetherColor, mono: TogetherMono },
  vllm: { color: VllmColor, mono: VllmMono },
  zhipu: { color: ZhipuColor, mono: ZhipuMono },
} satisfies Record<BrandMarkName, MarkDrawing>;

type BrandMarkProps = {
  /** Which vendor of the inventory the mark stands for. */
  name: BrandMarkName;
  /**
   * Whether the vendor's own colors are drawn, or its outline on the ink around it.
   *
   * @summary Reach for `mono` where the row it leads is inert, so the mark takes that row's
   * quieter ink instead of pulling the eye with a full-strength logo.
   */
  variant?: BrandMarkVariant;
  /** Size classes, replacing the standing 20px square rather than adding to it. */
  className?: string;
};

/**
 * The mark that leads a provider's row, drawn as the vendor draws it.
 *
 * @summary Reach for it wherever a provider's name appears in a list, so a person finds the row by
 * its shape before reading a word. The mark is decorative, because the provider's name always
 * stands beside it, and a product that publishes no mark leads with a glyph instead.
 */
export function BrandMark({ name, variant = 'color', className = 'size-5' }: BrandMarkProps) {
  const Drawing = marks[name][variant];

  return <Drawing aria-hidden className={`shrink-0 ${className}`} />;
}
