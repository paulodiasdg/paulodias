import { describe, expect, it } from 'vitest';
import { centavos, somar } from './dinheiro.js';

describe('dinheiro', () => {
  it('soma valores em centavos inteiros', () => {
    expect(somar([52000, 213000, 73000])).toBe(338000);
  });

  it('recusa valores que não são centavos inteiros', () => {
    expect(() => centavos(10.5)).toThrow(RangeError);
    expect(() => somar([100, 0.1])).toThrow(RangeError);
  });
});
