import type { ReactNode } from 'react';

export default function LayoutAutenticacao({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-2xl font-semibold tracking-tight text-azul-700">
          No Azul
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
