export function nativeSignature(marker = 0x39): string {
  const payload = Buffer.from([0x01, 0x0c, marker]);
  const inner = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, inner.length]), inner]).toString('base64');
}

export function responseOf(parts: unknown[], finishReason: string | null = 'STOP') {
  return {
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finishReason === null ? {} : { finishReason }),
      },
    ],
  };
}

export function toolResultBody(model = 'gemini-3.6-flash-high') {
  return {
    model,
    contents: [
      { role: 'user', parts: [{ text: 'run it' }] },
      {
        role: 'user',
        parts: [{ functionResponse: { id: 'call-1', name: 'Bash', response: { ok: true } } }],
      },
    ],
  };
}
