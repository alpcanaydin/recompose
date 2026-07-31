export type ParentPort = {
  postMessage: (message: unknown) => void;
  on: (event: 'message', listener: (messageEvent: { data: unknown }) => void) => void;
};

function carriesParentPort(host: object): host is { parentPort: ParentPort } {
  return 'parentPort' in host && typeof host.parentPort === 'object' && host.parentPort !== null;
}

export function readParentPort(host: object): ParentPort {
  if (!carriesParentPort(host)) {
    throw new Error(
      'The engine child needs the parent port of a utility process, and this process carries none.',
    );
  }

  return host.parentPort;
}
