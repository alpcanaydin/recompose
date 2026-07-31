import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { encodeIco, type RasterImage } from './ico-container.mts';
import {
  type DirectoryEntry,
  DIRECTORY_ENTRY_BYTES,
  DIRECTORY_HEADER_BYTES,
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

const generatedLadder = fc.array(generatedRaster, { minLength: 1, maxLength: 3 });

type Sample = readonly [number, number, number, number];

type GeneratedEntry = RasterImage & { samples: readonly Sample[] };

function premultipliedFrom(samples: readonly Sample[]): Uint8Array {
  return Uint8Array.from(
    samples.flatMap(([red, green, blue, alpha]) => [
      Math.round((red * alpha) / 255),
      Math.round((green * alpha) / 255),
      Math.round((blue * alpha) / 255),
      alpha,
    ]),
  );
}

function maskBitFor(
  maskBytes: readonly number[],
  size: number,
  row: number,
  column: number,
): number {
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const maskByte = maskBytes[(size - 1 - row) * maskRowBytes + (column >> 3)] ?? 0;

  return (maskByte >> (7 - (column & 7))) & 1;
}

function verifyEntryPixels(
  container: Buffer,
  directory: readonly DirectoryEntry[],
  entryIndex: number,
  raster: GeneratedEntry,
): void {
  const { size, samples, rgba } = raster;
  const payload = payloadAt(container, directory, entryIndex);
  const pixels = pixelsFromBitmap(payload, size);
  const maskBytes = maskRowsOf(payload, size);

  samples.forEach(([, , , alpha], sample) => {
    const base = sample * 4;
    const straightOf = (premultipliedChannel: number): number =>
      alpha === 0 ? 0 : Math.min(255, Math.round((premultipliedChannel * 255) / alpha));

    expect(pixels[base]).toBe(straightOf(rgba[base] ?? 0));
    expect(pixels[base + 1]).toBe(straightOf(rgba[base + 1] ?? 0));
    expect(pixels[base + 2]).toBe(straightOf(rgba[base + 2] ?? 0));
    expect(pixels[base + 3]).toBe(alpha);

    expect(maskBitFor(maskBytes, size, Math.floor(sample / size), sample % size)).toBe(
      alpha === 0 ? 1 : 0,
    );
  });
}

describe('the invariants every generated icon ladder keeps', () => {
  propertyTest.prop([generatedLadder])(
    'any ladder stays contiguous, converts to straight alpha, and masks exactly its clear pixels',
    (ladder) => {
      const rasters: readonly GeneratedEntry[] = ladder.map(({ size, samples }, at) => ({
        size,
        samples,
        rgba: premultipliedFrom(samples),
        png: rendererPng(at + 1),
      }));
      const container = encodeIco(rasters);
      const directory = readDirectory(container);

      let expectedOffset = DIRECTORY_HEADER_BYTES + rasters.length * DIRECTORY_ENTRY_BYTES;

      rasters.forEach((raster, at) => {
        const entry = entryAt(directory, at);

        expect(entry.offset).toBe(expectedOffset);
        expectedOffset += entry.byteLength;

        verifyEntryPixels(container, directory, at, raster);
      });

      expect(expectedOffset).toBe(container.length);
    },
  );
});
