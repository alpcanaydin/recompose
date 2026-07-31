import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

import { iconOutputs } from './generate-icons.mts';

/**
 * What regenerating every raster from the masters costs, with room for a loaded machine.
 *
 * @summary The work is real rendering rather than a comparison, and it runs beside every other
 * unit file. Vitest's five-second default is shorter than the work takes on a quiet machine.
 */
const RASTER_BUDGET = 60_000;

describe('the committed rasters and containers', () => {
  it(
    'covers exactly the icon files the packaging targets resolve',
    { timeout: RASTER_BUDGET },
    () => {
      expect(
        iconOutputs()
          .map(([path]) => `${basename(dirname(path))}/${basename(path)}`)
          .toSorted(),
      ).toEqual([
        'build/icon.ico',
        'build/volume.icns',
        'icons/128x128.png',
        'icons/16x16.png',
        'icons/24x24.png',
        'icons/256x256.png',
        'icons/32x32.png',
        'icons/48x48.png',
        'icons/512x512.png',
        'icons/64x64.png',
        'icons/96x96.png',
        'resources/icon.png',
        'resources/tray.png',
        'resources/trayTemplate.png',
        'resources/trayTemplate@2x.png',
      ]);
    },
  );

  it(
    'matches a regeneration from the masters byte for byte, so no hand edit survives',
    { timeout: RASTER_BUDGET },
    () => {
      for (const [path, bytes] of iconOutputs()) {
        expect({ path, bytes: Buffer.from(readFileSync(path)) }).toEqual({
          path,
          bytes: Buffer.from(bytes),
        });
      }
    },
  );
});
