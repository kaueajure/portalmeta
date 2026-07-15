import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLogo } from '../ui/Logo';
import { Menu, X, Mail } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
  onLogin: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicLayout = ({ children, onLogin, currentPath, onNavigate }: PublicLayoutProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: 'Início', path: '/' },
    { label: 'Funcionalidades', path: '/funcionalidades' },
    { label: 'Demonstração', path: '/demonstracao' },
    { label: 'Preços', path: '/precos' },
    { label: 'Contato', path: '/contato' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    setIsMenuOpen(false);
    onNavigate(path);
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-900 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a 
            href="/" 
            onClick={(e) => handleNavClick(e, '/')} 
            className="flex items-center gap-2 group outline-none"
          >
            <AppLogo size={24} className="group-hover:scale-105 transition-transform" />
            <span className="text-lg font-bold tracking-tight text-slate-900">Gestifique</span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a 
                key={item.path} 
                href={item.path} 
                className={`text-[13px] font-semibold transition-colors outline-none
                  ${currentPath === item.path ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                onClick={(e) => handleNavClick(e, item.path)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition-colors outline-none"
            >
              Entrar
            </button>
            <button 
              onClick={() => onNavigate('/contato')}
              className="h-9 px-5 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition-all active:scale-95 outline-none shadow-sm shadow-blue-200"
            >
              Solicitar demonstração
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-slate-600 p-2 outline-none hover:bg-slate-50 rounded-lg"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMenuOpen}
            aria-controls="public-mobile-menu"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              id="public-mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-4 space-y-4">
                {navItems.map((item) => (
                  <a 
                    key={item.path} 
                    href={item.path} 
                    className={`block text-sm font-semibold 
                      ${currentPath === item.path ? 'text-blue-600' : 'text-slate-600'}`}
                    onClick={(e) => handleNavClick(e, item.path)}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="pt-4 flex flex-col gap-3 border-t border-slate-100">
                  <button 
                    onClick={() => { setIsMenuOpen(false); onLogin(); }} 
                    className="h-10 w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700"
                  >
                    Entrar
                  </button>
                  <button 
                    onClick={() => { setIsMenuOpen(false); onNavigate('/contato'); }} 
                    className="h-10 w-full bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm"
                  >
                    Solicitar demonstração
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-16 flex flex-col bg-white">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100 bg-slate-50 mt-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-2 grayscale-0">
              <AppLogo size={24} />
              <span className="font-bold text-slate-900 tracking-tight text-lg">Gestifique</span>
            </div>
            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs">
              Sua operação mais estruturada. A plataforma enxuta para centralizar tickets B2B e SLA.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
             <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider mb-2">Para Clientes</h4>
             <a href="/funcionalidades" onClick={(e) => handleNavClick(e, '/funcionalidades')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors inline-block w-fit">Funcionalidades</a>
             <a href="/precos" onClick={(e) => handleNavClick(e, '/precos')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors inline-block w-fit">Preços</a>
             <button onClick={onLogin} className="text-sm text-slate-500 hover:text-blue-600 transition-colors text-left w-fit cursor-pointer">Login (Portal e Atendente)</button>
          </div>

          <div className="flex flex-col gap-3">
             <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider mb-2">Comercial</h4>
             <a href="/contato" onClick={(e) => handleNavClick(e, '/contato')} className="text-sm text-slate-500 hover:text-blue-600 transition-colors inline-block w-fit">Agendar Demonstração</a>
             <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                <Mail size={16} className="text-slate-400" />
                <span>contato@gestifique.com.br</span>
             </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-200 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] font-semibold text-slate-400">© {new Date().getFullYear()} Gestifique. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6 text-[12px] font-semibold text-slate-400">
            <a href="/termos-de-uso" onClick={(e) => handleNavClick(e, '/termos-de-uso')} className="hover:text-blue-600 transition-colors">
              Termos de Uso
            </a>
            <a href="/politica-de-privacidade" onClick={(e) => handleNavClick(e, '/politica-de-privacidade')} className="hover:text-blue-600 transition-colors">
              Política de Privacidade
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
