import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { attachEngineChild } = await import('../engine-child');

function parentSend(): (message: unknown) => void {
  const sendToParent = process.send?.bind(process);

  if (sendToParent === undefined) {
    throw new Error('the hygiene child expects the IPC channel a fork provides');
  }

  return (message) => {
    sendToParent(message);
  };
}

const send = parentSend();

attachEngineChild(
  {
    postMessage: (message) => {
      send(message);
    },
    on: (event, listener) => {
      process.on(event, (payload: unknown) => {
        listener({ data: payload });
      });
    },
  },
  async () => Promise.resolve({ opened: { close: async () => Promise.resolve() } }),
);

send({ ready: true });
