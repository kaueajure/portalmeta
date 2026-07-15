import React from 'react';
import { ArrowRight, Loader2, ShieldCheck, Cloud } from 'lucide-react';
import { AppLogo } from '../ui/Logo';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { AuthLayout } from './AuthLayout';
import { AuthAlert } from './AuthAlert';

interface ForgotPasswordPageProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  authError: string | null;
  authSuccess: string | null;
  onBackToLogin: () => void;
  onBackToSite: () => void;
  loading: boolean;
}

export const ForgotPasswordPage = ({ onSubmit, authError, authSuccess, onBackToLogin, onBackToSite, loading }: ForgotPasswordPageProps) => {
  return (
    <AuthLayout>
      <div className="text-center lg:text-left mb-6">
        <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
          <AppLogo size={24} />
          <span className="text-lg font-bold tracking-tight text-slate-900">Gestifique</span>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold mb-4 uppercase tracking-wider">
          <Cloud size={12} /> Gestifique Cloud
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Recuperar senha</h2>
        <p className="text-[14px] font-medium text-slate-500">Informe o e-mail cadastrado para receber o código de recuperação.</p>
      </div>

      <Card className="p-6 md:p-8 bg-white border border-slate-200 shadow-sm rounded-xl">
        <form onSubmit={onSubmit} className="space-y-5">
          {authError && <AuthAlert type="error" message={authError} />}
          {authSuccess && <AuthAlert type="success" message={authSuccess} />}

          <Input
            label="E-mail Corporativo"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-10 text-[14px] bg-slate-50 border-slate-200 focus:bg-white focus:ring-blue-500"
            placeholder="exemplo@empresa.com"
            disabled={loading}
          />

          <div className="pt-2">
            <Button type="submit" className="w-full h-11 text-[14px] font-bold shadow-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> Processando...
                </>
              ) : (
                'Enviar código'
              )}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <button
          onClick={onBackToLogin}
          className="text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition-colors outline-none inline-flex items-center gap-1.5"
          disabled={loading}
        >
          <ArrowRight size={14} className="rotate-180" /> Voltar ao login
        </button>
        <button
          onClick={onBackToSite}
          className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors outline-none inline-flex items-center gap-1.5"
          disabled={loading}
        >
           Ir para o site público
        </button>
        
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-2">
           <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Ambiente protegido</span>
        </div>
      </div>
    </AuthLayout>
  );
};
