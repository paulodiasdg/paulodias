import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@no-azul/motor'],
  // Os testes ponta a ponta acessam o servidor de desenvolvimento por 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
