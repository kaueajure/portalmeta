import React, { useState, useEffect } from 'react';
import { PublicLayout } from './PublicLayout';
import { PublicHomePage } from './PublicHomePage';
import { PublicFeaturesPage } from './PublicFeaturesPage';
import { PublicPricingPage } from './PublicPricingPage';
import { PublicContactPage } from './PublicContactPage';
import { PublicPreviewPage } from './PublicPreviewPage';
import { PublicPrivacyPolicyPage, PublicTermsOfUsePage } from './PublicLegalPages';

interface PublicSiteProps {
  onLogin: () => void;
}

export const PublicSite = ({ onLogin }: PublicSiteProps) => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const renderContent = () => {
    switch (currentPath) {
      case '/':
        return <PublicHomePage onNavigate={navigate} />;
      case '/funcionalidades':
        return <PublicFeaturesPage onNavigate={navigate} />;
      case '/precos':
        return <PublicPricingPage onNavigate={navigate} />;
      case '/contato':
        return <PublicContactPage />;
      case '/demonstracao':
      case '/preview':
        return <PublicPreviewPage onNavigate={navigate} />;
      case '/politica-de-privacidade':
        return <PublicPrivacyPolicyPage />;
      case '/termos-de-uso':
        return <PublicTermsOfUsePage />;
      default:
        return <PublicHomePage onNavigate={navigate} />;
    }
  };

  useEffect(() => {
    const validPaths = ['/', '/funcionalidades', '/precos', '/contato', '/demonstracao', '/preview', '/politica-de-privacidade', '/termos-de-uso'];
    if (!validPaths.includes(currentPath)) {
      window.history.replaceState({}, '', '/');
      setCurrentPath('/');
    }
  }, [currentPath]);

  useEffect(() => {
    // Dynamic document title based on current path
    const titles: Record<string, string> = {
      '/': 'Gestifique — Gestão de tickets e atendimento',
      '/funcionalidades': 'Funcionalidades | Gestifique',
      '/precos': 'Preços | Gestifique',
      '/contato': 'Contato | Gestifique',
      '/demonstracao': 'Demonstração | Gestifique',
      '/preview': 'Demonstração | Gestifique',
      '/politica-de-privacidade': 'Política de Privacidade | Gestifique',
      '/termos-de-uso': 'Termos de Uso | Gestifique'
    };
    document.title = titles[currentPath] || 'Gestifique';
  }, [currentPath]);

  return (
    <PublicLayout 
      onLogin={onLogin} 
      currentPath={currentPath} 
      onNavigate={navigate}
    >
      {renderContent()}
    </PublicLayout>
  );
};
