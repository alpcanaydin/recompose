export type GeminiRefusal = {
  error: { code: number; message: string; status: string };
};

function geminiStatus(status: number): string {
  if (status === 404) return 'NOT_FOUND';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status >= 500) return 'INTERNAL';

  return 'INVALID_ARGUMENT';
}

export function geminiRefusal(status: number, message: string): GeminiRefusal {
  return { error: { code: status, message, status: geminiStatus(status) } };
}
