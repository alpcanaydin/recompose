import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { encodeIco } from './ico-container.mts';
import {
  entryAt,
  maskRowsOf,
  payloadAt,
  pixelsFromBitmap,
  readDirectory,
  rendererPng,
} from './ico-container.testkit.mts';

const straightChannel = fc.integer({ min: 0, max: 255 });

const generatedRaster = fc.integer({ min: 1, max: 8 }).chain((size) =>
  fc
    .array(fc.tuple(straightChannel, straightChannel, straightChannel, straightChannel), {
      minLength: size * size,
      maxLength: size * size,
    })
    .map((samples) => ({ size, samples })),
);

function premultipliedFrom(
  samples: readonly (readonly [number, number, number, number])[],
): Uint8Array {
  return Uint8Array.from(
    samples.flatMap(([red, green, blue, alpha]) => [
      Math.round((red * alpha) / 255),
      Math.round((green * alpha) / 255),
      Math.round((blue * alpha) / 255),
      alpha,
    ]),
  );
}

describe('the invariants every generated bitmap entry keeps', () => {
  propertyTest.prop([generatedRaster])(
    'any raster stays contiguous, converts to straight alpha, and masks exactly its clear samples',
    ({ size, samples }) => {
      const rgba = premultipliedFrom(samples);
      const container = encodeIco([{ size, rgba, png: rendererPng(0x0f) }]);
      const directory = readDirectory(container);
      const entry = entryAt(directory, 0);

      expect(entry.offset + entry.byteLength).toBe(container.length);

      const payload = payloadAt(container, directory, 0);
      const pixels = pixelsFromBitmap(payload, size);

      samples.forEach(([, , , alpha], sample) => {
        const base = sample * 4;
        const straightOf = (premultipliedChannel: number): number =>
          alpha === 0 ? 0 : Math.min(255, Math.round((premultipliedChannel * 255) / alpha));

        expect(pixels[base]).toBe(straightOf(rgba[base] ?? 0));
        expect(pixels[base + 1]).toBe(straightOf(rgba[base + 1] ?? 0));
        expect(pixels[base + 2]).toBe(straightOf(rgba[base + 2] ?? 0));
        expect(pixels[base + 3]).toBe(alpha);
      });

      const maskedSamples = maskRowsOf(payload, size).reduce(
        (count, maskByte) => count + maskByte.toString(2).split('1').length - 1,
        0,
      );

      expect(maskedSamples).toBe(samples.filter(([, , , alpha]) => alpha === 0).length);
    },
  );
});
