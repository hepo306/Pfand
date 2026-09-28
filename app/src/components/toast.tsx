import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ArrowSquareOut, CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { explorerTx } from "../lib/config";

type Toast = { id: number; kind: "success" | "error"; title: string; body?: string; sig?: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 6000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_40px_-12px_rgb(20_40_30/0.35)]"
          >
            {t.kind === "success" ? (
              <CheckCircle size={22} weight="fill" className="shrink-0 text-accent" />
            ) : (
              <WarningCircle size={22} weight="fill" className="shrink-0 text-danger" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-ink-2">{t.body}</p>}
              {t.sig && (
                <a
                  href={explorerTx(t.sig)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  View on Solana Explorer <ArrowSquareOut size={12} />
                </a>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
