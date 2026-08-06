const MASK = 0xffff_ffff_ffff_ffffn;
const PRIME_1 = 11400714785074694791n;
const PRIME_2 = 14029467366897019727n;
const PRIME_3 = 1609587929392839161n;
const PRIME_4 = 9650029242287828579n;
const PRIME_5 = 2870177450012600261n;

function unsigned(value: bigint): bigint {
  return value & MASK;
}

function rotateLeft(value: bigint, bits: number): bigint {
  const shift = BigInt(bits);

  return unsigned((unsigned(value) << shift) | (unsigned(value) >> (64n - shift)));
}

function multiply(left: bigint, right: bigint): bigint {
  return unsigned(left * right);
}

function round(accumulator: bigint, input: bigint): bigint {
  return multiply(rotateLeft(unsigned(accumulator + multiply(input, PRIME_2)), 31), PRIME_1);
}

function mergeRound(hash: bigint, value: bigint): bigint {
  return unsigned(multiply(hash ^ round(0n, value), PRIME_1) + PRIME_4);
}

function read64(view: DataView, offset: number): bigint {
  return view.getBigUint64(offset, true);
}

function longHash(view: DataView, seed: bigint): { hash: bigint; offset: number } {
  let first = unsigned(seed + PRIME_1 + PRIME_2);
  let second = unsigned(seed + PRIME_2);
  let third = seed;
  let fourth = unsigned(seed - PRIME_1);
  let offset = 0;

  while (offset <= view.byteLength - 32) {
    first = round(first, read64(view, offset));
    second = round(second, read64(view, offset + 8));
    third = round(third, read64(view, offset + 16));
    fourth = round(fourth, read64(view, offset + 24));
    offset += 32;
  }

  let hash = unsigned(
    rotateLeft(first, 1) + rotateLeft(second, 7) + rotateLeft(third, 12) + rotateLeft(fourth, 18),
  );

  for (const value of [first, second, third, fourth]) {
    hash = mergeRound(hash, value);
  }

  return { hash, offset };
}

function consumeTail(view: DataView, initial: bigint, start: number): bigint {
  let hash = initial;
  let offset = start;

  while (offset <= view.byteLength - 8) {
    hash ^= round(0n, read64(view, offset));
    hash = unsigned(multiply(rotateLeft(hash, 27), PRIME_1) + PRIME_4);
    offset += 8;
  }

  if (offset <= view.byteLength - 4) {
    hash ^= BigInt(view.getUint32(offset, true)) * PRIME_1;
    hash = unsigned(multiply(rotateLeft(hash, 23), PRIME_2) + PRIME_3);
    offset += 4;
  }

  while (offset < view.byteLength) {
    hash ^= BigInt(view.getUint8(offset)) * PRIME_5;
    hash = multiply(rotateLeft(hash, 11), PRIME_1);
    offset += 1;
  }

  return hash;
}

function avalanche(initial: bigint): bigint {
  let hash = initial;

  hash ^= hash >> 33n;
  hash = multiply(hash, PRIME_2);
  hash ^= hash >> 29n;
  hash = multiply(hash, PRIME_3);
  hash ^= hash >> 32n;

  return unsigned(hash);
}

export function xxhash64(bytes: Uint8Array, seed: bigint): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const initial =
    bytes.byteLength >= 32 ? longHash(view, seed) : { hash: unsigned(seed + PRIME_5), offset: 0 };
  const withLength = unsigned(initial.hash + BigInt(bytes.byteLength));

  return avalanche(consumeTail(view, withLength, initial.offset));
}
