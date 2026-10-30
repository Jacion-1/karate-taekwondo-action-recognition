import React, { createContext, useCallback, useContext, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      setTimeout(() => {
        removeToast(id);
      }, 3600);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const iconMap: Record<ToastType, React.ReactNode> = {
            success: <Check className="w-4 h-4 text-status-success shrink-0" />,
            info: <Info className="w-4 h-4 text-brand-primary shrink-0" />,
            warning: <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-status-danger shrink-0" />,
          };

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-panel bg-app-surface/95 border border-app-border backdrop-blur-xl shadow-card text-app-primary"
            >
              <div className="mt-0.5">{iconMap[t.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-app-primary">{t.title}</p>
                {t.message && (
                  <p className="text-caption text-app-muted mt-0.5 leading-relaxed break-words">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-app-muted hover:text-app-primary p-0.5 rounded-control transition"
                aria-label="關閉通知"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
