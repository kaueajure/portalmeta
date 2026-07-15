import React from "react";
import { ShieldAlert, Home } from "lucide-react";
import { Button } from "./Button";

export const AccessDenied = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
      <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mb-4 border border-red-100">
        <ShieldAlert size={24} />
      </div>
      <h2 className="text-base font-semibold text-slate-900 mb-2 tracking-tight">
        Acesso Bloqueado
      </h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
        Você não tem permissão de "Desenvolvedor" para gerenciar esta área.
      </p>
      <Button variant="outline" onClick={() => (window.location.href = "/")}>
        <Home size={14} /> Voltar para o Início
      </Button>
    </div>
  );
};
