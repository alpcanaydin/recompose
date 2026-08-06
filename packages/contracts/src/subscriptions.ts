import { z } from 'zod';

import { nonBlankString } from './non-blank';

export const subscriptionProviderIdSchema = z.enum(['anthropic', 'openai', 'antigravity']);

export type SubscriptionProviderId = z.infer<typeof subscriptionProviderIdSchema>;

export const subscriptionProviders = {
  anthropic: {
    toolBinary: 'claude',
    toolName: 'Claude Code',
    configHomeVariable: 'CLAUDE_CONFIG_DIR',
    signInArguments: [],
  },
  openai: {
    toolBinary: 'codex',
    toolName: 'Codex',
    configHomeVariable: 'CODEX_HOME',
    signInArguments: ['login'],
  },
  antigravity: {
    toolBinary: 'cliproxyapi',
    toolName: 'Gemini (Antigravity)',
    configHomeVariable: 'CLIPROXYAPI_HOME',
    signInArguments: ['--antigravity-login'],
  },
} as const satisfies Record<
  SubscriptionProviderId,
  {
    toolBinary: string;
    toolName: string;
    configHomeVariable: string;
    signInArguments: readonly string[];
  }
>;

export const subscriptionStandingSchema = z.enum(['connected', 'lapsed']);

export const subscriptionAccountViewSchema = z.strictObject({
  id: nonBlankString,
  provider: subscriptionProviderIdSchema,
  label: z.string().trim().min(1),
  signedInAs: nonBlankString.optional(),
  plan: nonBlankString.optional(),
  standing: subscriptionStandingSchema,
  active: z.boolean(),
});

export type SubscriptionAccountView = z.infer<typeof subscriptionAccountViewSchema>;

export const subscriptionToolSchema = z.strictObject({
  provider: subscriptionProviderIdSchema,
  toolName: nonBlankString,
  present: z.boolean(),
  signInCommand: nonBlankString,
  shellSetupLine: nonBlankString,
});

export type SubscriptionTool = z.infer<typeof subscriptionToolSchema>;
