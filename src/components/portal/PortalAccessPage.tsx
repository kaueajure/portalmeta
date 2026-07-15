import React, { useState } from 'react';
import { Mail, ShieldCheck, ArrowLeft, Loader2, Building2, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { isValidEmail } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Logo } from '../ui/Logo';

interface PortalAccessPageProps {
  onAuthenticated: (data: {
    token?: string;
    customer: {
      email: string;
      empresa_id: number;
      nome?: string;
      empresa_nome?: string;
    };
  }) => void;
  onBackToLogin?: () => void;
}

export const PortalAccessPage: React.FC<PortalAccessPageProps> = ({ onAuthenticated, onBackToLogin }) => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [organizationEmail, setOrganizationEmail] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(organizationEmail)) {
      setError('E-mail da organização inválido.');
      return;
    }
    if (!isValidEmail(customerEmail)) {
      setError('Seu e-mail é inválido.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post('/portal-auth/request-code', {
        organization_email: organizationEmail.trim(),
        customer_email: customerEmail.trim()
      });
      setStep('verify');
      setSuccessMessage('Código enviado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar código. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      setError('Código inválido ou incompleto.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await api.post<{
        token?: string;
        customer: {
          email: string;
          empresa_id: number;
          nome?: string;
          empresa_nome?: string;
        }
      }>('/portal-auth/verify-code', {
        organization_email: organizationEmail.trim(),
        customer_email: customerEmail.trim(),
        code: code.trim()
      });
      
      onAuthenticated(response);
    } catch (err: any) {
      setError(err.message || 'Código inválido ou expirado. Verifique o código e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError(null);
    try {
      await api.post('/portal-auth/request-code', {
        organization_email: organizationEmail.trim(),
        customer_email: customerEmail.trim()
      });
      setSuccessMessage('Um novo código foi enviado.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar código.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-4">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] md:flex-row">
        
        {/* Left Column */}
        <div className="flex flex-col justify-between bg-slate-950 p-8 text-white md:w-5/12 md:p-12">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Logo className="text-white fill-white" />
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-white">Portal do Cliente</h1>
            <p className="mb-8 leading-relaxed text-slate-300">
              Acompanhe seus chamados, envie respostas, anexe arquivos e consulte a base de conhecimento da organização.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                <span className="text-sm text-slate-100">Visualize o andamento dos seus chamados</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                <span className="text-sm text-slate-100">Abra novos chamados rapidamente</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                <span className="text-sm text-slate-100">Responda sem precisar criar senha</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                <span className="text-sm text-slate-100">Consulte artigos da base de conhecimento</span>
              </li>
            </ul>
          </div>
          
          <div className="mt-12 flex gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
             <KeyRound size={20} className="shrink-0 text-blue-300" />
             <p className="leading-snug text-slate-200">Seu acesso é protegido por código temporário enviado ao seu e-mail.</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="p-8 md:p-12 md:w-7/12">
          <div className="max-w-sm mx-auto h-full flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              {step === 'request' ? (
                <motion.div
                  key="request"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesse seus chamados</h2>
                  <p className="text-sm text-slate-500 mb-8">
                    Informe o e-mail da organização e o seu e-mail para receber um código de acesso seguro.
                  </p>

                  <form onSubmit={handleRequestCode} className="space-y-5">
                    <Input
                      label="E-mail da organização"
                      type="email"
                      value={organizationEmail}
                      onChange={(e) => setOrganizationEmail(e.target.value)}
                      placeholder="suporte@empresa.com"
                      autoComplete="email"
                      inputSize="lg"
                      required
                    />

                    <Input
                      label="Seu e-mail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      inputSize="lg"
                      required
                    />

                    {error && (
                      <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full text-base font-semibold"
                      loading={loading}
                    >
                      Enviar código de acesso
                    </Button>
                  </form>

                  {onBackToLogin && (
                    <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <p className="text-sm text-slate-600 mb-2">Faz parte da equipe?</p>
                      <Button
                        type="button"
                        variant="subtle"
                        onClick={onBackToLogin}
                        className="w-full text-sm font-medium"
                      >
                        Sou atendente ou administrador
                      </Button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={() => {
                      setStep('request');
                      setError(null);
                      setCode('');
                    }}
                    className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors"
                  >
                    <ArrowLeft size={16} className="mr-1" />
                    Editar e-mails
                  </button>

                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Digite o código</h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Enviamos um código de acesso para <strong className="font-semibold text-slate-800">{customerEmail}</strong>.
                  </p>

                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <Input
                      label="Código de acesso"
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 123456"
                      autoComplete="one-time-code"
                      inputSize="lg"
                      className="text-center text-2xl tracking-widest font-mono font-bold placeholder:text-base placeholder:tracking-normal placeholder:font-sans"
                      maxLength={6}
                      required
                    />

                    {error && (
                      <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 leading-tight">
                        {error}
                      </div>
                    )}
                    
                    {successMessage && (
                       <div className="p-3 bg-emerald-50 text-emerald-800 text-sm font-medium rounded-lg border border-emerald-100">
                         {successMessage}
                       </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full text-base font-semibold"
                      loading={loading}
                      disabled={code.length < 4}
                    >
                      Entrar no portal
                    </Button>
                  </form>

                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendLoading}
                      className="text-sm font-medium text-slate-500 hover:text-blue-600 disabled:opacity-50 transition-colors inline-flex items-center"
                    >
                      {resendLoading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                      Reenviar código
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
};
