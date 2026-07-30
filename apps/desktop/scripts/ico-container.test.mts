import { describe, expect, it } from 'vitest';

import { encodeIco, type RasterImage } from './ico-container.mts';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DIRECTORY_HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;

type DirectoryEntry = {
  width: number;
  height: number;
  planes: number;
  bitCount: number;
  byteLength: number;
  offset: number;
};

function opaqueSquare(size: number, red: number): RasterImage {
  const rgba = new Uint8Array(size * size * 4);

  for (let pixel = 0; pixel < size * size; pixel += 1) {
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = 0x40;
    rgba[pixel * 4 + 2] = 0x80;
    rgba[pixel * 4 + 3] = 0xff;
  }

  return { size, rgba };
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

      expect(payload.readUInt32LE(0)).toBe(40);
      expect(payload.readInt32LE(4)).toBe(size);
      expect(payload.readInt32LE(8)).toBe(size * 2);
      expect(payload.readUInt16LE(14)).toBe(32);
    }
  });

  it('writes the 256 entry as the PNG composition Windows scales down from', () => {
    const payload = payloadAt(encoded, entries, 2);

    expect(payload.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    expect(payload.readUInt32BE(16)).toBe(256);
    expect(payload.readUInt32BE(20)).toBe(256);
  });

  it('orders the bitmap channels blue first and its rows bottom up', () => {
    const single = encodeIco([opaqueSquare(2, 0xaa)]);
    const pixels = single.subarray(6 + 16 + 40, 6 + 16 + 40 + 4);

    expect([...pixels]).toEqual([0x80, 0x40, 0xaa, 0xff]);
  });

  it('refuses an image whose buffer does not match its declared edge', () => {
    expect(() => encodeIco([{ size: 16, rgba: new Uint8Array(8) }])).toThrow('16');
  });
});
