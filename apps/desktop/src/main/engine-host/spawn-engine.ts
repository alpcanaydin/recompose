import engineChildPath from '@recompose/engine/child?modulePath';
import { utilityProcess } from 'electron';

import type { EngineChild } from './engine-host';

export function spawnEngineChild(): EngineChild {
  const engine = utilityProcess.fork(engineChildPath);

  engine.on('error', (type, location, report) => {
    console.error(`The engine hit a ${type} at ${location}.`, report);
  });

  return {
    postMessage: (directive) => {
      engine.postMessage(directive);
    },
    onMessage: (listener) => {
      engine.on('message', listener);
    },
    onExit: (listener) => {
      engine.on('exit', listener);
    },
    kill: () => {
      engine.kill();
    },
  };
}
