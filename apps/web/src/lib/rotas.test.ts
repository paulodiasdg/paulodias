import { describe, expect, it } from 'vitest';
import { destinoSeguro, ehRotaDeEntrada, ehRotaProtegida } from './rotas';

describe('rotas', () => {
  it('protege o painel e suas subpáginas', () => {
    expect(ehRotaProtegida('/painel')).toBe(true);
    expect(ehRotaProtegida('/painel/semana')).toBe(true);
    expect(ehRotaProtegida('/painelx')).toBe(false);
    expect(ehRotaProtegida('/entrar')).toBe(false);
  });

  it('reconhece as rotas de entrada', () => {
    expect(ehRotaDeEntrada('/entrar')).toBe(true);
    expect(ehRotaDeEntrada('/criar-cadastro')).toBe(true);
    expect(ehRotaDeEntrada('/painel')).toBe(false);
  });

  it('só aceita destinos internos depois do login', () => {
    expect(destinoSeguro('/painel?semana=2026-11-02')).toBe('/painel?semana=2026-11-02');
    expect(destinoSeguro(undefined)).toBe('/painel');
    expect(destinoSeguro('https://golpe.example')).toBe('/painel');
    expect(destinoSeguro('//golpe.example')).toBe('/painel');
    expect(destinoSeguro('/\\golpe.example')).toBe('/painel');
    expect(destinoSeguro('/entrar')).toBe('/painel');
  });
});
