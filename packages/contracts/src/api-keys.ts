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

const authoredIssueSchema = z.looseObject({ code: z.literal('custom'), message: z.string() });

function issuesOrNothing(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

export function authoredRefusalIn(serializedIssues: string): string | undefined {
  const issues = z.array(z.unknown()).safeParse(issuesOrNothing(serializedIssues));

  if (!issues.success) {
    return undefined;
  }

  for (const issue of issues.data) {
    const authored = authoredIssueSchema.safeParse(issue);

    if (authored.success) {
      return authored.data.message;
    }
  }

  return undefined;
}
