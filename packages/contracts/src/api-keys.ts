import { z } from 'zod';

export const keyProviderIdSchema = z.enum(['anthropic', 'openai']);

export type KeyProviderId = z.infer<typeof keyProviderIdSchema>;

const controlCharacter = /\p{Cc}/u;

export const recognizedKeyShapeSchema = z.enum(['anthropic', 'openai', 'openrouter']);

export type RecognizedKeyShape = z.infer<typeof recognizedKeyShapeSchema>;

const documentedKeyOpenings = [
  { opening: 'sk-ant-', shape: 'anthropic' },
  { opening: 'sk-or-v1-', shape: 'openrouter' },
] as const satisfies readonly { opening: string; shape: RecognizedKeyShape }[];

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

export function vendorShapeOf(pasted: string): RecognizedKeyShape | undefined {
  const trimmed = pasted.trim();

  return documentedKeyOpenings.find(({ opening }) => trimmed.startsWith(opening))?.shape;
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
