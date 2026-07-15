import React from 'react';
import { AlertCircle, Shield, Info } from 'lucide-react';

interface AuthAlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

export const AuthAlert = ({ type, message }: AuthAlertProps) => {
  const styles = {
    error: 'bg-red-50 border-red-100 text-red-600',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    info: 'bg-blue-50 border-blue-100 text-blue-700',
  };

  const Icon = {
    error: AlertCircle,
    success: Shield,
    info: Info,
  }[type];

  return (
    <div className={`px-3 py-2.5 border rounded-lg flex items-start gap-2.5 text-[13px] font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 ${styles[type]}`}>
      <Icon size={16} className="mt-[2px] shrink-0" />
      <span>{message}</span>
    </div>
  );
};
