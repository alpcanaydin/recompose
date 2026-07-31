import { describe, expect, it } from 'vitest';

import { encodeIco, type RasterImage } from './ico-container.mts';
import {
  type DirectoryEntry,
  BITMAP_HEADER_BYTES,
  DIRECTORY_ENTRY_BYTES,
  DIRECTORY_HEADER_BYTES,
  gradientSquare,
  maskRowsOf,
  opaqueSquare,
  payloadAt,
  pixelsFromBitmap,
  readDirectory,
  rendererPng,
} from './ico-container.testkit.mts';

const LADDER_EDGES = [16, 48, 256];

function ladderRenditions(): readonly RasterImage[] {
  return [opaqueSquare(16, 0x10), opaqueSquare(48, 0x30), opaqueSquare(256, 0xf0)];
}

function encodedLadder(): { container: Buffer; entries: readonly DirectoryEntry[] } {
  const container = encodeIco(ladderRenditions());

  return { container, entries: readDirectory(container) };
}

describe('the Windows icon directory', () => {
  it('announces itself as an icon holding one entry per rendition', () => {
    const { container } = encodedLadder();

    expect(container.readUInt16LE(0)).toBe(0);
    expect(container.readUInt16LE(2)).toBe(1);
    expect(container.readUInt16LE(4)).toBe(LADDER_EDGES.length);
  });

  it('records each rendition at its own edge, writing 256 as the zero the format reserves', () => {
    const { entries } = encodedLadder();

    expect(entries.map((entry) => entry.width)).toEqual([16, 48, 0]);
    expect(entries.map((entry) => entry.height)).toEqual([16, 48, 0]);
  });

  it('declares every entry as a single plane of 32 bit color', () => {
    for (const entry of encodedLadder().entries) {
      expect(entry.planes).toBe(1);
      expect(entry.bitCount).toBe(32);
    }
  });

  it('lays every payload out back to back after the directory', () => {
    const { container, entries } = encodedLadder();
    let expectedOffset = DIRECTORY_HEADER_BYTES + LADDER_EDGES.length * DIRECTORY_ENTRY_BYTES;

    for (const entry of entries) {
      expect(entry.offset).toBe(expectedOffset);
      expectedOffset += entry.byteLength;
    }

    expect(container.byteLength).toBe(expectedOffset);
  });

  it('sizes the directory at six header bytes plus sixteen per entry', () => {
    const { entries } = encodedLadder();
    const [first] = entries;

    expect(first?.offset).toBe(6 + 16 * LADDER_EDGES.length);
  });

  it('declares each payload length as the bytes that payload actually occupies', () => {
    const { container, entries } = encodedLadder();

    expect(entries.map((entry) => entry.byteLength)).toEqual([
      BITMAP_HEADER_BYTES + 16 * 16 * 4 + 4 * 16,
      BITMAP_HEADER_BYTES + 48 * 48 * 4 + 8 * 48,
      rendererPng(0xf0).length,
    ]);
    expect(container.byteLength).toBe(
      DIRECTORY_HEADER_BYTES +
        LADDER_EDGES.length * DIRECTORY_ENTRY_BYTES +
        entries.reduce((total, entry) => total + entry.byteLength, 0),
    );
  });
});

describe('the Windows icon payloads', () => {
  it('writes the entries below 256 as bitmaps carrying their own mask rows', () => {
    const { container, entries } = encodedLadder();

    for (const [index, size] of [16, 48].entries()) {
      const payload = payloadAt(container, entries, index);

      expect(payload.readUInt32LE(0)).toBe(BITMAP_HEADER_BYTES);
      expect(payload.readInt32LE(4)).toBe(size);
      expect(payload.readInt32LE(8)).toBe(size * 2);
      expect(payload.readUInt16LE(14)).toBe(32);
    }
  });

  it('declares the pixel byte count the bitmap header promises a reader', () => {
    const { container, entries } = encodedLadder();

    expect(payloadAt(container, entries, 0).readUInt32LE(20)).toBe(16 * 16 * 4);
    expect(payloadAt(container, entries, 1).readUInt32LE(20)).toBe(48 * 48 * 4);
  });

  it('hands the 256 entry the renderer PNG untouched, rather than re encoding it', () => {
    const { container, entries } = encodedLadder();

    expect([...payloadAt(container, entries, 2)]).toEqual([...rendererPng(0xf0)]);
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

const STRAIGHT_SAMPLES = [15, 30, 75, 17, 200, 100, 50, 255, 0, 0, 0, 0, 255, 128, 0, 128];
const PREMULTIPLIED_BY_THE_RENDERER = Uint8Array.from([
  1, 2, 5, 17, 200, 100, 50, 255, 9, 9, 9, 0, 128, 64, 0, 128,
]);

function premultipliedPairPayload(): Buffer {
  const container = encodeIco([
    { size: 2, rgba: PREMULTIPLIED_BY_THE_RENDERER, png: rendererPng(0x02) },
  ]);

  return payloadAt(container, readDirectory(container), 0);
}

describe('the alpha a Windows icon bitmap carries', () => {
  it('divides out the premultiplied alpha, because the format stores it straight', () => {
    expect([...pixelsFromBitmap(premultipliedPairPayload(), 2)]).toEqual(STRAIGHT_SAMPLES);
  });

  it('drops the color of a sample with no alpha, rather than dividing by zero', () => {
    expect([...pixelsFromBitmap(premultipliedPairPayload(), 2)].slice(8, 12)).toEqual([0, 0, 0, 0]);
  });

  it('leaves the alpha channel itself untouched', () => {
    expect(
      [...pixelsFromBitmap(premultipliedPairPayload(), 2)].filter((_unused, at) => at % 4 === 3),
    ).toEqual([17, 255, 0, 128]);
  });

  it('marks only the fully transparent pixels in the mask legacy shells still read', () => {
    expect(maskRowsOf(premultipliedPairPayload(), 2)).toEqual([0x80, 0, 0, 0, 0x00, 0, 0, 0]);
  });
});
