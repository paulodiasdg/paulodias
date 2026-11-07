import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lerAmbiente } from './ambiente.js';
import {
  clienteAdmin,
  clienteVisitante,
  criarUsuario,
  excluirUsuario,
  type UsuarioDeTeste,
} from './apoio.js';

/**
 * Isolamento dos arquivos de documentos (regra 5 do CLAUDE.md, também para o Storage): cada
 * pessoa só lê, grava, troca e apaga arquivos na própria pasta do bucket privado `documentos`.
 */

const ambiente = lerAmbiente();
const BUCKET = 'documentos';
const conteudo = new Blob(['%PDF-1.7 documento de teste'], { type: 'application/pdf' });

let a: UsuarioDeTeste;
let b: UsuarioDeTeste;
let caminhoDeA: string;

beforeAll(async () => {
  a = await criarUsuario(ambiente, 'StorageA');
  b = await criarUsuario(ambiente, 'StorageB');
  caminhoDeA = `${a.id}/${randomUUID()}`;
  const { error } = await a.cliente.storage.from(BUCKET).upload(caminhoDeA, conteudo, {
    contentType: 'application/pdf',
  });
  if (error) throw error;
});

afterAll(async () => {
  await clienteAdmin(ambiente).storage.from(BUCKET).remove([caminhoDeA]);
  await excluirUsuario(ambiente, a.id);
  await excluirUsuario(ambiente, b.id);
});

describe('Storage: bucket documentos', () => {
  it('é privado: sem link público', async () => {
    const { data } = await clienteAdmin(ambiente).storage.getBucket(BUCKET);
    expect(data?.public).toBe(false);
    const resposta = await fetch(
      `${ambiente.url}/storage/v1/object/public/${BUCKET}/${caminhoDeA}`,
    );
    expect(resposta.ok).toBe(false);
  });

  it('a dona lê e lista o próprio arquivo', async () => {
    const baixado = await a.cliente.storage.from(BUCKET).download(caminhoDeA);
    expect(baixado.error).toBeNull();
    expect(await baixado.data?.text()).toContain('documento de teste');
    const lista = await a.cliente.storage.from(BUCKET).list(a.id);
    expect(lista.data?.length).toBe(1);
  });

  it('B não lê, não lista e não gera link do arquivo de A', async () => {
    const baixado = await b.cliente.storage.from(BUCKET).download(caminhoDeA);
    expect(baixado.data).toBeNull();
    const lista = await b.cliente.storage.from(BUCKET).list(a.id);
    expect(lista.data ?? []).toEqual([]);
    const link = await b.cliente.storage.from(BUCKET).createSignedUrl(caminhoDeA, 60);
    expect(link.data).toBeNull();
  });

  it('B não troca nem apaga o arquivo de A', async () => {
    const trocado = await b.cliente.storage
      .from(BUCKET)
      .update(caminhoDeA, new Blob(['invasor']), { contentType: 'text/plain' });
    expect(trocado.error).not.toBeNull();
    await b.cliente.storage.from(BUCKET).remove([caminhoDeA]);
    const aindaLa = await a.cliente.storage.from(BUCKET).download(caminhoDeA);
    expect(await aindaLa.data?.text()).toContain('documento de teste');
  });

  it('B não grava na pasta de A nem fora de uma pasta', async () => {
    const naPastaDeA = await b.cliente.storage
      .from(BUCKET)
      .upload(`${a.id}/${randomUUID()}`, conteudo);
    expect(naPastaDeA.error).not.toBeNull();
    const naRaiz = await b.cliente.storage.from(BUCKET).upload(`${randomUUID()}.pdf`, conteudo);
    expect(naRaiz.error).not.toBeNull();
  });

  it('quem não entrou não lê nem grava nada', async () => {
    const visitante = clienteVisitante(ambiente);
    const baixado = await visitante.storage.from(BUCKET).download(caminhoDeA);
    expect(baixado.data).toBeNull();
    const enviado = await visitante.storage
      .from(BUCKET)
      .upload(`${a.id}/${randomUUID()}`, conteudo);
    expect(enviado.error).not.toBeNull();
  });

  it('recusa arquivo acima de 15 MB', async () => {
    const grande = new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: 'application/pdf' });
    const enviado = await a.cliente.storage.from(BUCKET).upload(`${a.id}/${randomUUID()}`, grande);
    expect(enviado.error).not.toBeNull();
  });
});
