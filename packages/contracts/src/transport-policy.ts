import { z } from 'zod';

const proxyProtocols = new Set(['http:', 'https:', 'socks5:', 'socks5h:']);

const proxyUrlSchema = z.url().refine((value) => {
  const parsed = new URL(value);

  return proxyProtocols.has(parsed.protocol) && parsed.username === '' && parsed.password === '';
}, 'proxy URL must use http, https, socks5, or socks5h without embedded credentials');

export const accountTransportPolicySchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('inherit') }),
  z.strictObject({ mode: z.literal('direct') }),
  z.strictObject({ mode: z.literal('proxy'), url: proxyUrlSchema }),
]);

export type AccountTransportPolicy = z.infer<typeof accountTransportPolicySchema>;
