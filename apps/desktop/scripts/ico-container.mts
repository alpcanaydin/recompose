import { deflateSync } from 'node:zlib';

export type RasterImage = { size: number; rgba: Uint8Array };

const DIRECTORY_HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;
const BITMAP_HEADER_BYTES = 40;
const PNG_ENTRY_SIZE = 256;
const DEFLATE_LEVEL = 9;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let remainder = index;

  for (let bit = 0; bit < 8; bit += 1) {
    remainder = remainder & 1 ? 0xedb88320 ^ (remainder >>> 1) : remainder >>> 1;
  }

  return remainder >>> 0;
});

function crc32(bytes: Buffer): number {
  let remainder = 0xffffffff;

  for (const byte of bytes) {
    remainder = (CRC_TABLE[(remainder ^ byte) & 0xff] ?? 0) ^ (remainder >>> 8);
  }

  return (remainder ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);

  length.writeUInt32BE(body.byteLength);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const checksum = Buffer.alloc(4);

  checksum.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, checksum]);
}

function encodePng({ size, rgba }: RasterImage): Buffer {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(6, 9);

  const rows = Buffer.alloc(size * (size * 4 + 1));

  for (let row = 0; row < size; row += 1) {
    rows.set(rgba.subarray(row * size * 4, (row + 1) * size * 4), row * (size * 4 + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: DEFLATE_LEVEL })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function swapRedAndBlue(pixels: Buffer): void {
  for (let at = 0; at < pixels.byteLength; at += 4) {
    const red = pixels.readUInt8(at);

    pixels.writeUInt8(pixels.readUInt8(at + 2), at);
    pixels.writeUInt8(red, at + 2);
  }
}

function bottomUpBgra(rgba: Uint8Array, size: number): Buffer {
  const rowBytes = size * 4;
  const pixels = Buffer.alloc(size * rowBytes);

  for (let row = 0; row < size; row += 1) {
    const from = (size - 1 - row) * rowBytes;

    pixels.set(rgba.subarray(from, from + rowBytes), row * rowBytes);
  }

  swapRedAndBlue(pixels);

  return pixels;
}

function encodeBitmap({ size, rgba }: RasterImage): Buffer {
  const header = Buffer.alloc(BITMAP_HEADER_BYTES);

  header.writeUInt32LE(BITMAP_HEADER_BYTES, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4, 20);

  const maskRowBytes = Math.ceil(size / 32) * 4;

  return Buffer.concat([header, bottomUpBgra(rgba, size), Buffer.alloc(maskRowBytes * size)]);
}

function payloadFor(image: RasterImage): Buffer {
  const expectedBytes = image.size * image.size * 4;

  if (image.rgba.byteLength !== expectedBytes) {
    throw new Error(
      `Icon entry at ${image.size} needs ${expectedBytes} bytes of pixels, received ${image.rgba.byteLength}`,
    );
  }

  return image.size >= PNG_ENTRY_SIZE ? encodePng(image) : encodeBitmap(image);
}

export function encodeIco(images: readonly RasterImage[]): Buffer {
  const payloads = images.map(payloadFor);

  const directory = Buffer.alloc(DIRECTORY_HEADER_BYTES + images.length * DIRECTORY_ENTRY_BYTES);

  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);

  let offset = directory.byteLength;

  images.forEach((image, index) => {
    const at = DIRECTORY_HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES;
    const payload = payloads[index] ?? Buffer.alloc(0);

    directory.writeUInt8(image.size % PNG_ENTRY_SIZE, at);
    directory.writeUInt8(image.size % PNG_ENTRY_SIZE, at + 1);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(payload.byteLength, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += payload.byteLength;
  });

  return Buffer.concat([directory, ...payloads]);
}
