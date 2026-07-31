import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { IpcResultError } from '../../../../shared/api';
import { previewAddressFor, portRefusal, nameRefusal, refusalFromMain } from './gateway-draft';

describe('the name a person types', () => {
  test('a plain name draws no refusal', () => {
    expect(nameRefusal('Codex')).toBeUndefined();
  });

  test('a name carrying spaces and punctuation draws no refusal, because the app derives around them', () => {
    expect(nameRefusal('Claude, Code & Friends')).toBeUndefined();
  });

  test('a name longer than a hostname label allows draws no refusal, because the app trims it', () => {
    expect(nameRefusal('A'.repeat(200))).toBeUndefined();
  });

  test('a name written in letters no slug can carry draws no refusal, because the app falls back', () => {
    expect(nameRefusal('网关')).toBeUndefined();
  });

  test('a name Windows keeps for a device says so in its own words', () => {
    expect(nameRefusal('Con')).toBe('Windows reserves this name.');
    expect(nameRefusal('lpt1')).toBe('Windows reserves this name.');
  });

  test('no name at all asks for one, rather than storing a gateway nobody named', () => {
    expect(nameRefusal('')).toBe('Give the gateway a name.');
  });

  test('a name of nothing but spacing asks for one too, because it names nothing', () => {
    expect(nameRefusal('   ')).toBe('Give the gateway a name.');
    expect(nameRefusal('\t\n')).toBe('Give the gateway a name.');
  });
});

describe('the port a person types', () => {
  test('a port inside the accepted range draws no refusal', () => {
    expect(portRefusal('9000')).toBeUndefined();
  });

  test('a port under the range states the range', () => {
    expect(portRefusal('80')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('1023')).toBe('Accepts 1024 through 65535.');
  });

  test('a port over the range states the same range', () => {
    expect(portRefusal('65536')).toBe('Accepts 1024 through 65535.');
  });

  test('the ends of the range are inside it', () => {
    expect(portRefusal('1024')).toBeUndefined();
    expect(portRefusal('65535')).toBeUndefined();
  });

  test('a port field holding no number states the range rather than staying silent', () => {
    expect(portRefusal('')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('eight thousand')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('8000.5')).toBe('Accepts 1024 through 65535.');
  });

  propertyTest.prop([fc.integer({ min: 1024, max: 65535 })])(
    'every port the gateway contract accepts passes the field',
    (port) => {
      expect(portRefusal(String(port))).toBeUndefined();
    },
  );

  propertyTest.prop([fc.integer({ min: -5000, max: 1023 })])(
    'no port below the range passes the field',
    (port) => {
      expect(portRefusal(String(port))).toBeDefined();
    },
  );
});

describe('where a refusal the main process sent lands on the sheet', () => {
  test('a port a stored gateway holds stands under the port field, naming that gateway', () => {
    expect(
      refusalFromMain(
        new IpcResultError({ code: 'port-conflict', message: 'codex already holds this port.' }),
      ),
    ).toEqual({ port: 'codex already holds this port.' });
  });

  test('a storage failure stands in the sheet, in the words the main process wrote', () => {
    expect(
      refusalFromMain(
        new IpcResultError({ code: 'storage-failed', message: 'EACCES: permission denied' }),
      ),
    ).toEqual({ sheet: 'EACCES: permission denied' });
  });

  test('a schema refusal trades its own words for a sentence, because it writes for a developer', () => {
    expect(
      refusalFromMain(
        new IpcResultError({ code: 'validation-failed', message: '[{"code":"too_small"}]' }),
      ),
    ).toEqual({ sheet: 'recompose cannot store this gateway as it stands.' });
  });

  test('a failure that never reached the main process still stands in the sheet', () => {
    expect(refusalFromMain(new Error('the bridge is gone'))).toEqual({
      sheet: 'the bridge is gone',
    });
  });
});

describe('the address the sheet previews', () => {
  test('the preview carries the port the field holds', () => {
    expect(previewAddressFor('9000')).toBe('http://localhost:9000');
  });

  test('an empty port field drops the port rather than previewing half an address', () => {
    expect(previewAddressFor('')).toBe('http://localhost');
  });

  test('the preview names no path, because the gateway serves at its root', () => {
    expect(new URL(previewAddressFor('51234')).pathname).toBe('/');
  });
});
