import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@no-azul/motor', '@no-azul/documentos'],
  // A leitura de documentos (Etapa 5) usa OCR, imagem e PDF com partes nativas, WebAssembly e
  // threads: essas bibliotecas rodam direto do node_modules, sem passar pelo empacotador.
  serverExternalPackages: [
    'tesseract.js',
    'sharp',
    '@napi-rs/canvas',
    'unpdf',
    'zxing-wasm',
    'exceljs',
  ],
  // Os testes ponta a ponta acessam o servidor de desenvolvimento por 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
