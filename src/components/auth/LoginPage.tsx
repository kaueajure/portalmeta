import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { AppLogo } from '../ui/Logo';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { AuthLayout } from './AuthLayout';
import { AuthAlert } from './AuthAlert';

interface LoginPageProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  authError: string | null;
  loading: boolean;
}

export const LoginPage = ({ onSubmit, authError, loading }: LoginPageProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <AppLogo size={40} />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Portal Meta</h1>
          <p className="mt-1 text-sm text-slate-500">Entre na sua conta</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {authError ? <AuthAlert type="error" message={authError} /> : null}

          <Input
            label="E-mail"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            inputSize="lg"
            placeholder="seu@email.com"
            disabled={loading}
          />

          <div className="space-y-1">
            <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
              Senha
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Sua senha"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </section>
    </AuthLayout>
  );
};
