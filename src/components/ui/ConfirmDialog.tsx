import React from "react";
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
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
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
                className="h-8 w-8 p-0 text-slate-400"
              >
                <X size={16} />
              </Button>
            </div>

            <h3 className="text-base font-semibold text-slate-950 mb-1.5">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              {description}
            </p>
          </div>

          <div className="px-5 py-3 bg-slate-50 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={onClose} className="px-4">
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
