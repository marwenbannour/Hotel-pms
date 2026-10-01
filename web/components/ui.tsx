'use client';

import { useEffect, useState } from 'react';

export const fieldClass =
  'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-brass disabled:opacity-60';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] text-ink-soft">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block text-[13px] text-maintenance">{error}</span>}
    </label>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-paper',
  danger: 'bg-maintenance text-white hover:bg-maintenance/90',
  ghost: 'text-ink-soft hover:text-ink underline-offset-4 hover:underline',
};

export function Button({ variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-maintenance/10 px-3 py-2 text-maintenance">
      {children}
    </p>
  );
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
