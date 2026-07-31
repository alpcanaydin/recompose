import engineChildPath from '@recompose/engine/child?modulePath';
import { utilityProcess } from 'electron';

import type { EngineChild } from './engine-host';

export function spawnEngineChild(): EngineChild {
  const engine = utilityProcess.fork(engineChildPath, [], { stdio: 'pipe' });

  engine.on('error', (type, location, report) => {
    console.error(`The engine hit a ${type} at ${location}.`, report);
  });

  engine.stderr?.on('data', (line: Buffer) => {
    console.error(`The engine child said: ${line.toString().trimEnd()}`);
  });

  engine.stdout?.on('data', (line: Buffer) => {
    console.log(`The engine child said: ${line.toString().trimEnd()}`);
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
