import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  requireInput?: boolean;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const colors = {
    danger:  { icon: 'text-red-700',    bg: 'bg-red-50',    btn: 'bg-red-600 hover:bg-red-700',    ring: 'ring-red-100' },
    warning: { icon: 'text-amber-700',  bg: 'bg-amber-50',  btn: 'bg-amber-700 hover:bg-amber-800', ring: 'ring-amber-100' },
    info:    { icon: 'text-brand-500',   bg: 'bg-brand-50',   btn: 'bg-brand-600 hover:bg-brand-700',  ring: 'ring-brand-100' },
  }[variant];

  return (
    <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className={`relative bg-white rounded-card shadow-2xl ring-4 ${colors.ring} w-full max-w-sm mx-4 p-6 animate-in`}>
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center mx-auto mb-4`}>
          <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
        </div>

        {/* Text */}
        <h3 className="text-center text-base font-semibold text-slate-800 mb-1">{title}</h3>
        <p className="text-center text-sm text-slate-600 leading-relaxed mb-6">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-card text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm()}
            className={`flex-1 px-4 py-2.5 rounded-card text-sm font-medium text-white transition-colors ${colors.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
