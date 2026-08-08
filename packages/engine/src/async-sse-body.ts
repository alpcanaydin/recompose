export function asyncSseBody<T>(
  events: AsyncIterable<T>,
  frame: (event: T) => string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const step = await iterator.next();

        if (step.done === true) {
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(frame(step.value)));
      } catch (failure) {
        controller.error(failure);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}
