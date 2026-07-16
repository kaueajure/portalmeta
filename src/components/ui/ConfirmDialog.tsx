import React, { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "warning",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLButtonElement>('[data-autofocus="true"]')?.focus();
    });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-sm bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200"
        >
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                  variant === "danger"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : variant === "warning"
                      ? "bg-amber-50 text-amber-600 border-amber-100"
                      : "bg-blue-50 text-blue-600 border-blue-100",
                )}
              >
                <AlertTriangle size={16} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Fechar confirmação"
                className="h-8 w-8 p-0 text-slate-400"
              >
                <X size={16} />
              </Button>
            </div>

            <h3 id={titleId} className="text-base font-semibold text-slate-950 mb-1.5">
              {title}
            </h3>
            <p id={descriptionId} className="text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>

          <div className="px-5 py-3 bg-slate-50 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button data-autofocus="true" variant="ghost" size="sm" onClick={onClose} className="px-4">
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "px-4",
                variant === "warning" &&
                  "bg-amber-600 hover:bg-amber-700 text-white border-none",
              )}
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
