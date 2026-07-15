import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clipboard,
  Copy,
  MousePointer2,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type MenuState = {
  open: boolean;
  x: number;
  y: number;
  selectedText: string;
};

const MENU_WIDTH = 232;
const MENU_HEIGHT = 236;
const EDGE_PADDING = 8;

export const AppContextMenu = () => {
  const [menu, setMenu] = useState<MenuState>({
    open: false,
    x: 0,
    y: 0,
    selectedText: '',
  });
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setMenu((current) => ({ ...current, open: false }));

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-native-context-menu="true"]')
      ) {
        return;
      }

      event.preventDefault();

      const selectedText = window.getSelection()?.toString().trim() || '';
      const x = Math.min(
        event.clientX,
        window.innerWidth - MENU_WIDTH - EDGE_PADDING
      );
      const y = Math.min(
        event.clientY,
        window.innerHeight - MENU_HEIGHT - EDGE_PADDING
      );

      setCopiedLabel(null);
      setMenu({
        open: true,
        x: Math.max(EDGE_PADDING, x),
        y: Math.max(EDGE_PADDING, y),
        selectedText,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const actions = useMemo(
    () => [
      {
        label: 'Voltar',
        icon: ArrowLeft,
        disabled: window.history.length <= 1,
        onClick: () => window.history.back(),
      },
      {
        label: 'Recarregar página',
        icon: RefreshCw,
        onClick: () => window.location.reload(),
      },
      {
        label: 'Copiar link',
        icon: Clipboard,
        onClick: async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopiedLabel('Link copiado');
        },
      },
      {
        label: 'Copiar seleção',
        icon: Copy,
        disabled: !menu.selectedText,
        onClick: async () => {
          await navigator.clipboard.writeText(menu.selectedText);
          setCopiedLabel('Texto copiado');
        },
      },
      {
        label: 'Imprimir',
        icon: Printer,
        onClick: () => window.print(),
      },
    ],
    [menu.selectedText]
  );

  if (!menu.open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="absolute w-[232px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
        style={{ left: menu.x, top: menu.y }}
        role="menu"
        aria-label="Menu contextual do Gestifique"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
          <MousePointer2 size={14} className="text-blue-600" />
          Ações rápidas
        </div>

        <div className="py-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={async () => {
                  if (action.disabled) return;
                  await action.onClick();
                  if (!action.label.startsWith('Copiar')) {
                    setMenu((current) => ({ ...current, open: false }));
                  }
                }}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 px-3 text-left text-sm font-medium text-slate-700 transition-colors',
                  'hover:bg-slate-50 hover:text-slate-950 focus:bg-slate-50 focus:outline-none',
                  action.disabled && 'cursor-not-allowed text-slate-300 hover:bg-white hover:text-slate-300'
                )}
                role="menuitem"
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>

        {copiedLabel && (
          <div className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-emerald-700">
            {copiedLabel}
          </div>
        )}
      </div>
    </div>
  );
};
