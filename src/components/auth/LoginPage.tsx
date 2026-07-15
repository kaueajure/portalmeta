import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, Cloud } from 'lucide-react';
import { AppLogo } from '../ui/Logo';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { AuthLayout } from './AuthLayout';
import { AuthAlert } from './AuthAlert';

interface LoginPageProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  authError: string | null;
  onForgotPassword: () => void;
  loading: boolean;
}

export const LoginPage = ({ onSubmit, authError, onForgotPassword, loading }: LoginPageProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout>
      <div className="text-center lg:text-left mb-6">
        <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
          <AppLogo size={24} />
          <span className="text-lg font-bold tracking-tight text-slate-900">Portal Meta</span>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold mb-4 uppercase tracking-wider">
          <Cloud size={12} /> Portal Meta Cloud
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Entrar no Portal Meta</h2>
        <p className="text-[14px] font-medium text-slate-500">Acesse sua central de atendimento.</p>
      </div>

      <Card className="p-6 md:p-8 bg-white border border-slate-200 shadow-sm rounded-xl">
        <form onSubmit={onSubmit} className="space-y-5">
          {authError && <AuthAlert type="error" message={authError} />}

          <Input
            label="E-mail Corporativo"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-10 text-[14px] bg-slate-50 border-slate-200 focus:bg-white focus:ring-blue-500"
            placeholder="usuario@portalmeta.com.br"
            disabled={loading}
          />

          <div className="space-y-1.5">
             <div className="flex items-center justify-between">
               <label className="text-[13px] font-semibold text-slate-700">Senha</label>
               <button
                 type="button"
                 onClick={onForgotPassword}
                 className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 hover:underline outline-none"
                 disabled={loading}
               >
                 Esqueceu a senha?
               </button>
             </div>
             <div className="relative">
               <input
                 name="password"
                 type={showPassword ? 'text' : 'password'}
                 required
                 autoComplete="current-password"
                 className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 text-[14px] font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                 placeholder="••••••••"
                 disabled={loading}
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 outline-none"
                 aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                 disabled={loading}
               >
                 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
               </button>
             </div>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full h-11 text-[14px] font-bold shadow-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
           <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Ambiente protegido</span>
           <span className="text-slate-300">•</span>
           <span>Acesso restrito</span>
        </div>
      </div>
    </AuthLayout>
  );
};
