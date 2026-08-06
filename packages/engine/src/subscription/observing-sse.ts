export function observingSseLines(
  body: ReadableStream<Uint8Array>,
  observe: (line: string) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = '';

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');

        buffer = lines.pop() ?? '';
        lines.forEach(observe);
      },
      flush() {
        observe(buffer + decoder.decode());
      },
    }),
  );
}
