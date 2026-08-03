import { z } from 'zod';

export const keyProviderIdSchema = z.enum(['anthropic', 'openai']);

export type KeyProviderId = z.infer<typeof keyProviderIdSchema>;

const controlCharacter = /\p{Cc}/u;

const anthropicKeyOpening = 'sk-ant-';

const tailLength = 4;

const shortestKeyThatPublishesATail = 9;

export const pastedKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine((key) => !controlCharacter.test(key), 'the key holds a control character');

export function keyTail(pasted: string): string | undefined {
  const trimmed = pasted.trim();

  return trimmed.length >= shortestKeyThatPublishesATail ? trimmed.slice(-tailLength) : undefined;
}

export function vendorShapeOf(pasted: string): KeyProviderId | undefined {
  return pasted.trim().startsWith(anthropicKeyOpening) ? 'anthropic' : undefined;
}

export const keyCheckVerdictSchema = z.enum(['authenticates', 'not-accepted', 'could-not-check']);

export type KeyCheckVerdict = z.infer<typeof keyCheckVerdictSchema>;

export const keyCheckReportSchema = z.strictObject({
  verdict: keyCheckVerdictSchema,
  status: z.number().int().optional(),
});

export type KeyCheckReport = z.infer<typeof keyCheckReportSchema>;
