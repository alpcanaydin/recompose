import type { RasterImage } from './ico-container.mts';

export const DIRECTORY_HEADER_BYTES = 6;

export const DIRECTORY_ENTRY_BYTES = 16;

export const BITMAP_HEADER_BYTES = 40;

export type DirectoryEntry = {
  width: number;
  height: number;
  planes: number;
  bitCount: number;
  byteLength: number;
  offset: number;
};

export function rendererPng(marker: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker]);
}

export function opaqueSquare(size: number, red: number): RasterImage {
  const rgba = new Uint8Array(size * size * 4);

  for (let pixel = 0; pixel < size * size; pixel += 1) {
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = 0x40;
    rgba[pixel * 4 + 2] = 0x80;
    rgba[pixel * 4 + 3] = 0xff;
  }

  return { size, rgba, png: rendererPng(red) };
}

export function readDirectory(container: Buffer): readonly DirectoryEntry[] {
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

export function entryAt(directory: readonly DirectoryEntry[], index: number): DirectoryEntry {
  const entry = directory[index];

  if (entry === undefined) {
    throw new Error(`The container declared no directory entry at ${index}`);
  }

  return entry;
}

export function payloadAt(
  container: Buffer,
  directory: readonly DirectoryEntry[],
  index: number,
): Buffer {
  const entry = entryAt(directory, index);

  return container.subarray(entry.offset, entry.offset + entry.byteLength);
}

export function gradientSquare(size: number): RasterImage {
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

export function pixelsFromBitmap(payload: Buffer, size: number): Uint8Array {
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

export function maskRowsOf(payload: Buffer, size: number): readonly number[] {
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const from = BITMAP_HEADER_BYTES + size * size * 4;

  return [...payload.subarray(from, from + maskRowBytes * size)];
}
