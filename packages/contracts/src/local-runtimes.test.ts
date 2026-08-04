import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import {
  documentedRuntimePort,
  localRuntimeIdSchema,
  localRuntimes,
  loopbackAddressSchema,
  RUNTIME_PORT_RANGE,
  runtimeAddressFor,
  runtimeLookBoundMs,
  runtimePortSchema,
  runtimeReachabilitySchema,
} from './local-runtimes';
import { nonBlankString } from './non-blank';

const documentedAddresses = () =>
  Object.values(localRuntimes).map((documented) => documented.address);

const addressParts = fc.record({
  scheme: fc.constantFrom('http', 'https', 'ws', 'wss', 'ftp', 'file', 'HTTP'),
  credentials: fc.constantFrom('', 'someone@', 'someone:secret@'),
  host: fc.constantFrom('127.0.0.1', 'localhost', '0.0.0.0', '127.0.0.2', '[::1]', 'example.com'),
  port: fc.constantFrom('', ':11434', ':1234', ':80', ':443'),
  trailing: fc.constantFrom('', '/', '/api/version', '?probe=1', '#top'),
});

describe('the runtimes a local account can name', () => {
  test('exactly the one runtime this release reaches', () => {
    expect(localRuntimeIdSchema.options).toEqual(['ollama']);
  });

  test('a runtime nothing detects yet is refused', () => {
    for (const awaited of ['llama.cpp', 'vllm', 'openai']) {
      expect(() => localRuntimeIdSchema.parse(awaited)).toThrow();
    }
  });
});

describe('the address a runtime documents itself at', () => {
  test('Ollama stands at the loopback address its own documentation publishes', () => {
    expect(localRuntimes.ollama.address).toBe('http://127.0.0.1:11434');
  });

  test('every runtime the vocabulary names has one address to reach it at', () => {
    expect(Object.keys(localRuntimes)).toEqual(localRuntimeIdSchema.options);
  });

  test('every documented address is one a stored row would admit', () => {
    for (const address of documentedAddresses()) {
      expect(loopbackAddressSchema.parse(address)).toBe(address);
    }
  });

  test('no documented address names the host that resolves to the wrong family', () => {
    for (const address of documentedAddresses()) {
      expect(address).not.toContain('localhost');
    }
  });
});

describe('the name a runtime goes by on screen', () => {
  test('Ollama reads as its own project spells it', () => {
    expect(localRuntimes.ollama.name).toBe('Ollama');
  });

  test('every runtime the vocabulary names carries one name to read it by', () => {
    for (const runtime of localRuntimeIdSchema.options) {
      expect(nonBlankString.parse(localRuntimes[runtime].name)).toBe(localRuntimes[runtime].name);
    }
  });
});

describe('the port a person may point a look at', () => {
  test('any port a loopback server can bind is admitted', () => {
    for (const port of [RUNTIME_PORT_RANGE.min, 11434, 9000, RUNTIME_PORT_RANGE.max]) {
      expect(runtimePortSchema.parse(port)).toBe(port);
    }
  });

  test('a number no port can be is refused', () => {
    for (const outside of [0, -1, RUNTIME_PORT_RANGE.max + 1, 11434.5, Number.NaN]) {
      expect(runtimePortSchema.safeParse(outside).success).toBe(false);
    }
  });

  test('a port arrives as a number rather than as text to coerce', () => {
    expect(runtimePortSchema.safeParse('11434').success).toBe(false);
  });
});

describe('the address main mints from the table and a chosen port', () => {
  test('no chosen port mints the documented address', () => {
    expect(runtimeAddressFor('ollama')).toBe(localRuntimes.ollama.address);
  });

  test('a chosen port mints the loopback host at that port', () => {
    expect(runtimeAddressFor('ollama', 9000)).toBe('http://127.0.0.1:9000');
  });

  test('the documented port itself mints the documented address', () => {
    expect(runtimeAddressFor('ollama', documentedRuntimePort('ollama'))).toBe(
      localRuntimes.ollama.address,
    );
  });

  test('the documented port reads out of the documented address', () => {
    expect(documentedRuntimePort('ollama')).toBe(11434);
  });

  test('port 80 keeps its :80 rather than being normalized away', () => {
    expect(runtimeAddressFor('ollama', 80)).toBe('http://127.0.0.1:80');
  });

  test('a number no port can be refuses loudly rather than minting anything', () => {
    for (const outside of [0, -1, RUNTIME_PORT_RANGE.max + 1, 11434.5, Number.NaN]) {
      expect(() => runtimeAddressFor('ollama', outside)).toThrow();
    }
  });

  test.prop([fc.integer({ min: RUNTIME_PORT_RANGE.min, max: RUNTIME_PORT_RANGE.max })])(
    'every minted address is one a stored row would admit, and none names localhost',
    (port) => {
      const minted = runtimeAddressFor('ollama', port);

      expect(loopbackAddressSchema.parse(minted)).toBe(minted);
      expect(minted).not.toContain('localhost');
    },
  );
});

describe('the bound a look at a runtime waits under', () => {
  test('a look gives a loopback server three seconds before it counts as silence', () => {
    expect(runtimeLookBoundMs).toBe(3_000);
  });
});

describe('the address a stored row and a probe directive both parse through', () => {
  test('the documented Ollama address is admitted whole', () => {
    expect(loopbackAddressSchema.parse('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
  });

  test('a loopback address over https is admitted, because the origin is what matters', () => {
    expect(loopbackAddressSchema.parse('https://127.0.0.1:11434')).toBe('https://127.0.0.1:11434');
  });

  test("a scheme's own default port is admitted spelled out, the way the mint spells it", () => {
    for (const speltOut of ['http://127.0.0.1:80', 'https://127.0.0.1:443']) {
      expect(loopbackAddressSchema.parse(speltOut)).toBe(speltOut);
    }
  });

  test.prop([addressParts])(
    'an address is admitted exactly when it is a bare loopback origin, default port spelled out or not',
    ({ scheme, credentials, host, port, trailing }) => {
      const address = `${scheme}://${credentials}${host}${port}${trailing}`;
      const isItsOwnLoopbackOrigin =
        (scheme === 'http' || scheme === 'https') &&
        credentials === '' &&
        host === '127.0.0.1' &&
        trailing === '';

      expect(loopbackAddressSchema.safeParse(address).success).toBe(isItsOwnLoopbackOrigin);
    },
  );
});

describe('what the loopback address schema turns away', () => {
  test('localhost is refused, because it resolves to a family the runtime never listens on', () => {
    expect(() => loopbackAddressSchema.parse('http://localhost:11434')).toThrow(/loopback origin/);
  });

  test('a trailing slash is refused, because the address is then no longer its own origin', () => {
    expect(() => loopbackAddressSchema.parse('http://127.0.0.1:11434/')).toThrow();
  });

  test('a path, a query, and a fragment are each refused', () => {
    for (const beyondTheOrigin of ['/api/version', '?probe=1', '#top']) {
      expect(() =>
        loopbackAddressSchema.parse(`http://127.0.0.1:11434${beyondTheOrigin}`),
      ).toThrow();
    }
  });

  test('credentials are refused, because nothing on a loopback address authenticates', () => {
    for (const carried of ['someone@', 'someone:secret@']) {
      expect(() => loopbackAddressSchema.parse(`http://${carried}127.0.0.1:11434`)).toThrow();
    }
  });

  test('every host but the one the table mints is refused', () => {
    for (const host of ['0.0.0.0', '127.0.0.2', '[::1]', 'example.com', '169.254.169.254']) {
      expect(() => loopbackAddressSchema.parse(`http://${host}:11434`)).toThrow();
    }
  });

  test('a scheme no probe speaks is refused', () => {
    for (const scheme of ['ws', 'wss', 'ftp', 'file']) {
      expect(() => loopbackAddressSchema.parse(`${scheme}://127.0.0.1:11434`)).toThrow();
    }
  });

  test('text that is no address at all is refused rather than crashing the parse', () => {
    for (const nothing of ['', '   ', '127.0.0.1:11434', 'not an address', '//127.0.0.1:11434']) {
      expect(loopbackAddressSchema.safeParse(nothing)).toMatchObject({ success: false });
    }
  });
});

describe('the reading a reachability look carries back', () => {
  test('a runtime that answered carries the version it reported', () => {
    const reading = { verdict: 'answers', version: '0.5.1' };

    expect(runtimeReachabilitySchema.parse(reading)).toEqual(reading);
  });

  test('a stranger on the port carries the status it answered with', () => {
    const reading = { verdict: 'unrecognized', status: 404 };

    expect(runtimeReachabilitySchema.parse(reading)).toEqual(reading);
  });

  test('silence carries nothing at all, because nothing answered to be carried', () => {
    const reading = { verdict: 'unreachable' };

    expect(runtimeReachabilitySchema.parse(reading)).toEqual(reading);
  });
});

describe('what a reachability reading refuses to carry', () => {
  test('a verdict outside the three is refused', () => {
    for (const verdict of ['running', 'stopped', 'reachable']) {
      expect(() => runtimeReachabilitySchema.parse({ verdict })).toThrow();
    }
  });

  test('the three verdicts stay disjoint from what a key check answers', () => {
    for (const verdict of ['authenticates', 'not-accepted', 'could-not-check']) {
      expect(() => runtimeReachabilitySchema.parse({ verdict })).toThrow();
    }
  });

  test('an answer carrying no version is refused, because the version is the observation', () => {
    expect(() => runtimeReachabilitySchema.parse({ verdict: 'answers' })).toThrow();
    expect(() => runtimeReachabilitySchema.parse({ verdict: 'answers', version: '   ' })).toThrow();
  });

  test('a stranger carrying no status is refused, because the status is what names it strange', () => {
    expect(() => runtimeReachabilitySchema.parse({ verdict: 'unrecognized' })).toThrow();
    expect(() =>
      runtimeReachabilitySchema.parse({ verdict: 'unrecognized', status: 404.5 }),
    ).toThrow();
  });

  test('no reading can carry another reading fields', () => {
    for (const smuggled of [
      { verdict: 'answers', version: '0.5.1', status: 200 },
      { verdict: 'unrecognized', status: 404, version: '0.5.1' },
      { verdict: 'unreachable', version: '0.5.1' },
      { verdict: 'unreachable', status: 0 },
    ]) {
      expect(() => runtimeReachabilitySchema.parse(smuggled)).toThrow();
    }
  });

  test('no reading has a field the runtime body could ride home in', () => {
    for (const smuggled of [
      { body: '{"version":"0.5.1"}' },
      { address: 'http://127.0.0.1:11434' },
    ]) {
      expect(() =>
        runtimeReachabilitySchema.parse({ verdict: 'answers', version: '0.5.1', ...smuggled }),
      ).toThrow();
    }
  });
});
