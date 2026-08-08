import { expect, test } from 'vitest';

import { xxhash64 } from './xxhash64';

test('xxhash64 matches the pierrec streaming implementation', () => {
  expect(xxhash64(new TextEncoder().encode('abc'), 0n)).toBe(0x44bc_2cf5_ad77_0999n);
  expect(xxhash64(new TextEncoder().encode('abcdefghijklmnopqrstuvwxyz0123456789'), 0n)).toBe(
    0x64f2_3ecf_1609_b766n,
  );
  const body = new TextEncoder().encode(
    '{"model":"","messages":[{"role":"user","content":[{"type":"text","text":"x"}]}],' +
      '"system":[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.220.test; ' +
      'cc_entrypoint=sdk-cli; cch=00000;"},{"type":"text","text":"system-x"}],"tools":[],' +
      '"metadata":{"user_id":"meta-x"},"thinking":{"type":"adaptive","display":"omitted"},' +
      '"context_management":{"edits":[{"type":"clear_thinking_20251015","keep":"all"}]},' +
      '"output_config":{"effort":"high"},"stream":true}',
  );

  expect(xxhash64(body, 0x4d65_9218_e32a_3268n)).toBe(0xb649_086f_38f7_ee87n);
});
