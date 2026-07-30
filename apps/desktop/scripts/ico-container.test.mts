import { describe, expect, it } from 'vitest';

import { encodeIco, type RasterImage } from './ico-container.mts';

const DIRECTORY_HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;
const BITMAP_HEADER_BYTES = 40;

type DirectoryEntry = {
  width: number;
  height: number;
  planes: number;
  bitCount: number;
  byteLength: number;
  offset: number;
};

function rendererPng(marker: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker]);
}

function opaqueSquare(size: number, red: number): RasterImage {
  const rgba = new Uint8Array(size * size * 4);

  for (let pixel = 0; pixel < size * size; pixel += 1) {
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = 0x40;
    rgba[pixel * 4 + 2] = 0x80;
    rgba[pixel * 4 + 3] = 0xff;
  }

  return { size, rgba, png: rendererPng(red) };
}

function readDirectory(container: Buffer): readonly DirectoryEntry[] {
  const count = container.readUInt16LE(4);

  return Array.from({ length: count }, (_unused, index) => {
    const at = DIRECTORY_HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES;

    return {
      width: container.readUInt8(at),
      height: container.readUInt8(at + 1),
      planes: container.readUInt16LE(at + 4),
      bitCount: container.readUInt16LE(at + 6),
      byteLength: container.readUInt32LE(at + 8),
      offset: container.readUInt32LE(at + 12),
    };
  });
}

function entryAt(directory: readonly DirectoryEntry[], index: number): DirectoryEntry {
  const entry = directory[index];

  if (entry === undefined) {
    throw new Error(`The container declared no directory entry at ${index}`);
  }

  return entry;
}

function payloadAt(container: Buffer, directory: readonly DirectoryEntry[], index: number): Buffer {
  const entry = entryAt(directory, index);

  return container.subarray(entry.offset, entry.offset + entry.byteLength);
}

function gradientSquare(size: number): RasterImage {
  const rgba = new Uint8Array(size * size * 4);

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const at = (row * size + column) * 4;

      rgba[at] = (column * 7) % 251;
      rgba[at + 1] = (row * 11) % 241;
      rgba[at + 2] = (row + column) % 239;
      rgba[at + 3] = 0xff;
    }
  }

  return { size, rgba, png: rendererPng(0x01) };
}

function pixelsFromBitmap(payload: Buffer, size: number): Uint8Array {
  const rowBytes = size * 4;
  const pixels = new Uint8Array(size * rowBytes);

  for (let row = 0; row < size; row += 1) {
    const from = BITMAP_HEADER_BYTES + (size - 1 - row) * rowBytes;

    for (let column = 0; column < size; column += 1) {
      const at = from + column * 4;
      const to = row * rowBytes + column * 4;

      pixels[to] = payload.readUInt8(at + 2);
      pixels[to + 1] = payload.readUInt8(at + 1);
      pixels[to + 2] = payload.readUInt8(at);
      pixels[to + 3] = payload.readUInt8(at + 3);
    }
  }

  return pixels;
}

function maskRowsOf(payload: Buffer, size: number): readonly number[] {
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const from = BITMAP_HEADER_BYTES + size * size * 4;

  return [...payload.subarray(from, from + maskRowBytes * size)];
}

const renditions = [opaqueSquare(16, 0x10), opaqueSquare(48, 0x30), opaqueSquare(256, 0xf0)];
const encoded = encodeIco(renditions);
const entries = readDirectory(encoded);

describe('the Windows icon directory', () => {
  it('announces itself as an icon holding one entry per rendition', () => {
    expect(encoded.readUInt16LE(0)).toBe(0);
    expect(encoded.readUInt16LE(2)).toBe(1);
    expect(encoded.readUInt16LE(4)).toBe(renditions.length);
  });

  it('records each rendition at its own edge, writing 256 as the zero the format reserves', () => {
    expect(entries.map((entry) => entry.width)).toEqual([16, 48, 0]);
    expect(entries.map((entry) => entry.height)).toEqual([16, 48, 0]);
  });

  it('declares every entry as a single plane of 32 bit color', () => {
    for (const entry of entries) {
      expect(entry.planes).toBe(1);
      expect(entry.bitCount).toBe(32);
    }
  });

  it('lays every payload out back to back after the directory', () => {
    let expectedOffset = DIRECTORY_HEADER_BYTES + renditions.length * DIRECTORY_ENTRY_BYTES;

    for (const entry of entries) {
      expect(entry.offset).toBe(expectedOffset);
      expectedOffset += entry.byteLength;
    }

    expect(encoded.byteLength).toBe(expectedOffset);
  });
});

describe('the Windows icon payloads', () => {
  it('writes the entries below 256 as bitmaps carrying their own mask rows', () => {
    for (const [index, size] of [16, 48].entries()) {
      const payload = payloadAt(encoded, entries, index);

      expect(payload.readUInt32LE(0)).toBe(BITMAP_HEADER_BYTES);
      expect(payload.readInt32LE(4)).toBe(size);
      expect(payload.readInt32LE(8)).toBe(size * 2);
      expect(payload.readUInt16LE(14)).toBe(32);
    }
  });

  it('hands the 256 entry the renderer PNG untouched, rather than re encoding it', () => {
    expect([...payloadAt(encoded, entries, 2)]).toEqual([...rendererPng(0xf0)]);
  });

  it('orders the bitmap channels blue first and its rows bottom up', () => {
    const single = encodeIco([opaqueSquare(2, 0xaa)]);
    const pixels = single.subarray(
      DIRECTORY_HEADER_BYTES + DIRECTORY_ENTRY_BYTES + BITMAP_HEADER_BYTES,
      DIRECTORY_HEADER_BYTES + DIRECTORY_ENTRY_BYTES + BITMAP_HEADER_BYTES + 4,
    );

    expect([...pixels]).toEqual([0x80, 0x40, 0xaa, 0xff]);
  });

  it('refuses an image whose buffer does not match its declared edge', () => {
    expect(() => encodeIco([{ size: 16, rgba: new Uint8Array(8), png: rendererPng(0) }])).toThrow(
      '16',
    );
  });

  it('returns every opaque bitmap pixel exactly as it went in', () => {
    const source = gradientSquare(32);
    const container = encodeIco([source]);

    expect(pixelsFromBitmap(payloadAt(container, readDirectory(container), 0), 32)).toEqual(
      source.rgba,
    );
  });
});

describe('the alpha a Windows icon bitmap carries', () => {
  const straight = [15, 30, 75, 17, 200, 100, 50, 255, 0, 0, 0, 0, 255, 128, 0, 128];
  const premultipliedByTheRenderer = Uint8Array.from([
    1, 2, 5, 17, 200, 100, 50, 255, 9, 9, 9, 0, 128, 64, 0, 128,
  ]);
  const container = encodeIco([
    { size: 2, rgba: premultipliedByTheRenderer, png: rendererPng(0x02) },
  ]);
  const payload = payloadAt(container, readDirectory(container), 0);

  it('divides out the premultiplied alpha, because the format stores it straight', () => {
    expect([...pixelsFromBitmap(payload, 2)]).toEqual(straight);
  });

  it('drops the color of a sample with no alpha, rather than dividing by zero', () => {
    expect([...pixelsFromBitmap(payload, 2)].slice(8, 12)).toEqual([0, 0, 0, 0]);
  });

  it('leaves the alpha channel itself untouched', () => {
    expect([...pixelsFromBitmap(payload, 2)].filter((_unused, at) => at % 4 === 3)).toEqual([
      17, 255, 0, 128,
    ]);
  });

  it('marks only the fully transparent pixels in the mask legacy shells still read', () => {
    expect(maskRowsOf(payload, 2)).toEqual([0x80, 0, 0, 0, 0x00, 0, 0, 0]);
  });
});
