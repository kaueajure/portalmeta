import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../../types';
import { api } from '../../lib/api';
import { AppLogo } from '../ui/Logo';
import { cn } from '../../lib/utils';
import { LogOut, Menu, X, Home, Ticket, FileText, PlusCircle } from 'lucide-react';
import { PortalHomePage } from './PortalHomePage';
import { PortalTicketsPage } from './PortalTicketsPage';
import { PortalTicketDetailsPage } from './PortalTicketDetailsPage';
import { PortalNewTicketPage } from './PortalNewTicketPage';
import { PortalKnowledgePage } from './PortalKnowledgePage';

export type PortalTab = 'home' | 'tickets' | 'new-ticket' | 'knowledge';

interface PortalLayoutProps {
  currentUser: User;
  onLogout: () => void;
}

export const PortalLayout = ({ currentUser, onLogout }: PortalLayoutProps) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (tab: PortalTab, id: number | null = null) => {
    setActiveTab(tab);
    if (tab === 'tickets') {
      setSelectedTicketId(id);
      setSelectedArticleId(null);
    } else if (tab === 'knowledge') {
      setSelectedArticleId(id);
      setSelectedTicketId(null);
    } else {
      setSelectedTicketId(null);
      setSelectedArticleId(null);
    }
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'tickets', icon: Ticket, label: 'Meus Chamados' },
    { id: 'new-ticket', icon: PlusCircle, label: 'Abrir Chamado' },
    { id: 'knowledge', icon: FileText, label: 'Base de Conhecimento' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F7FA] font-sans text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="cursor-pointer" onClick={() => navigateTo('home')}>
              <AppLogo size={24} />
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id as PortalTab)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
                      isActive 
                        ? "border border-blue-200 bg-blue-50 text-blue-800 shadow-sm shadow-blue-600/5" 
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                    )}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <div className="text-sm font-semibold text-slate-900">{currentUser.nome}</div>
              <div className="text-xs text-slate-500">Cliente</div>
            </div>
            
            <button 
              onClick={onLogout}
              className="text-slate-400 hover:text-red-600 transition-colors hidden md:block"
              title="Sair"
            >
               <LogOut size={18} />
            </button>

            <button 
              className="md:hidden text-slate-500 p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="p-3 space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id as PortalTab)}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-blue-50 text-blue-700" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
              <div className="pt-2 mt-1 border-t border-slate-100">
                <button
                  onClick={onLogout}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={16} /> Sair do Sistema
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedTicketId || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'home' && (
              <PortalHomePage onNavigate={navigateTo} />
            )}
            {activeTab === 'tickets' && !selectedTicketId && (
              <PortalTicketsPage onSelectTicket={(id) => navigateTo('tickets', id)} />
            )}
            {activeTab === 'tickets' && selectedTicketId && (
              <PortalTicketDetailsPage 
                ticketId={selectedTicketId} 
                onBack={() => navigateTo('tickets')} 
                currentUser={currentUser}
              />
            )}
            {activeTab === 'new-ticket' && (
              <PortalNewTicketPage onNavigate={navigateTo} currentUser={currentUser} />
            )}
            {activeTab === 'knowledge' && (
              <PortalKnowledgePage onNavigate={navigateTo} initialArticleId={selectedArticleId} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-4 pb-5 text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-400 shadow-sm">
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-600 transition-colors"
          >
            Política de Privacidade
          </a>
          <span className="text-slate-300">•</span>
          <a
            href="/termos-de-uso"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-600 transition-colors"
          >
            Termos de Uso
          </a>
        </div>
      </footer>
    </div>
  );
};
