function validClaudeTimezone(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  const timezone = value.trim();

  try {
    new Date(0).toLocaleString('en-US', { timeZone: timezone });

    return timezone;
  } catch {
    return undefined;
  }
}

export function resolvedClaudeTimezone(
  credentialTimezone: unknown,
  configuredTimezone: unknown,
): string | undefined {
  return validClaudeTimezone(credentialTimezone) ?? validClaudeTimezone(configuredTimezone);
}

export function claudeLocalDate(now: number, timezone?: string): string {
  const date = new Date(now);

  if (timezone === undefined) return localCalendarDate(date);

  const rendered = date.toLocaleDateString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [month = '', day = '', year = ''] = rendered.split('/');

  return `${year}-${month}-${day}`;
}

function localCalendarDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
