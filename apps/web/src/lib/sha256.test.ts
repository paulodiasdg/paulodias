import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256, sha256Puro } from './sha256';

const hexDoNode = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('SHA-256 do envio de documentos', () => {
  it('a implementação própria bate com a do Node em vários tamanhos', () => {
    for (const tamanho of [0, 1, 55, 56, 63, 64, 65, 1000, 100_000]) {
      const bytes = new Uint8Array(randomBytes(tamanho));
      expect(hex(sha256Puro(bytes)), `tamanho ${tamanho}`).toBe(hexDoNode(bytes));
    }
  });

  it('com Web Crypto, dá o mesmo resultado', async () => {
    const bytes = new TextEncoder().encode('No Azul');
    expect(await sha256(bytes)).toBe(hexDoNode(bytes));
  });
});
