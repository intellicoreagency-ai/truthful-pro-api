import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite يحمّل ملفات wasm محلية؛ يُترك خارج حزمة الخادم
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
