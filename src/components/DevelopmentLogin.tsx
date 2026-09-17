import React, { FormEvent, useState } from 'react';
import { Code2, LogIn } from 'lucide-react';

export interface DevelopmentSessionUser {
  id: string;
  email: string;
  name: string;
}

interface DevelopmentLoginProps {
  onAuthenticated: (user: DevelopmentSessionUser) => void;
}

export function DevelopmentLogin({ onAuthenticated }: DevelopmentLoginProps) {
  const [email, setEmail] = useState('developer@sfa.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/development/sign-in', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.user) {
        throw new Error(result?.error || 'Unable to sign in to local development.');
      }
      onAuthenticated(result.user);
    } catch (requestError) {
      const isTransportFailure = requestError instanceof TypeError && /fetch/i.test(requestError.message);
      setError(
        isTransportFailure
          ? 'Local API is unavailable. Start `npm run dev` from the project folder, then reload this page.'
          : requestError instanceof Error ? requestError.message : 'Unable to sign in to local development.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-sky-400/25 bg-sky-400/10 p-3.5" aria-label="Local development login">
      <div className="mb-3 flex items-start gap-2">
        <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
        <div>
          <p className="text-xs font-black text-sky-100">Local development access</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">Only available from the local development server. Credentials are set in <code className="font-mono text-slate-300">.env.local</code>.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          aria-label="Development email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 rounded-lg border border-slate-600 bg-slate-950/60 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-400"
        />
        <input
          aria-label="Development password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Development password"
          className="min-w-0 rounded-lg border border-slate-600 bg-slate-950/60 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-400"
        />
      </div>
      {error && <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        {isSubmitting ? 'Signing in…' : 'Open local workspace'}
      </button>
    </form>
  );
}
