import React, { useState } from 'react';
import { ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, Cloud } from 'lucide-react';
import { AppLogo } from '../ui/Logo';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { AuthLayout } from './AuthLayout';
import { AuthAlert } from './AuthAlert';

interface ResetPasswordPageProps {
  onSubmit: (email: string, token: string, newPassword: string) => void;
  authError: string | null;
  authSuccess: string | null;
  onBackToLogin: () => void;
  onBackToSite: () => void;
  loading: boolean;
  initialEmail: string;
}

export const ResetPasswordPage = ({ onSubmit, authError, authSuccess, onBackToLogin, onBackToSite, loading, initialEmail }: ResetPasswordPageProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (newPassword.length < 8) {
      setLocalError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError("As senhas informadas não conferem.");
      return;
    }

    if (!email) {
      setLocalError("O e-mail é obrigatório.");
      return;
    }

    onSubmit(email, token, newPassword);
  };

  const displayError = localError || authError;

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
        
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Criar nova senha</h2>
        <p className="text-[14px] font-medium text-slate-500">Informe o código recebido e defina uma nova senha de acesso.</p>
      </div>

      <Card className="p-6 md:p-8 bg-white border border-slate-200 shadow-sm rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {displayError && <AuthAlert type="error" message={displayError} />}
          {authSuccess && <AuthAlert type="success" message={authSuccess} />}

          {!initialEmail ? (
             <Input
               label="E-mail"
               name="email"
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               required
               autoComplete="email"
               className="h-10 text-[14px] bg-slate-50 border-slate-200 focus:bg-white focus:ring-blue-500"
               placeholder="exemplo@empresa.com"
               disabled={loading}
             />
          ) : (
            <div className="space-y-1.5">
               <label className="text-[13px] font-semibold text-slate-700">E-mail</label>
               <div className="h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center text-[14px] text-slate-500 font-medium">
                 {email}
               </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-slate-700">Código de 6 dígitos</label>
            <input
              name="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="one-time-code"
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-center text-lg font-bold tracking-[0.2em] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
              placeholder="000000"
              maxLength={6}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-slate-700">Nova senha</label>
            <div className="relative">
              <input
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 text-[14px] font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                placeholder="Mínimo 8 caracteres"
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

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-slate-700">Confirmar nova senha</label>
            <div className="relative">
              <input
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 text-[14px] font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                placeholder="Repita a nova senha"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 outline-none"
                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full h-11 text-[14px] font-bold shadow-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
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
