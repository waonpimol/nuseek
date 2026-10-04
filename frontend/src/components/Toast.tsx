import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3200;
const MAX_TOASTS = 3;

// ข้อความแจ้งผลสั้นๆ ที่ไม่ต้องให้ผู้ใช้กดปิด (เช่น "บันทึกแล้ว")
// ใช้ ResultModal ต่อไปสำหรับเรื่องสำคัญที่ผู้ใช้ต้องอ่านและตัดสินใจต่อ
// Provider อยู่ระดับแอป (main.tsx) toast จึงไม่หายตอนเปลี่ยนหน้าทันทีหลังกดบันทึก
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_TOASTS));

    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ลอยกลางล่างจอ เหนือ ResultModal (z-index 1000) */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 sm:bottom-8 flex flex-col items-center gap-2 px-4"
        style={{ zIndex: 1100 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex items-center gap-2 max-w-[92vw] sm:max-w-sm bg-gray-900 text-white text-xs sm:text-sm rounded-xl px-4 py-2.5 shadow-lg"
          >
            {t.type === "success" ? (
              <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-400" />
            ) : (
              <XCircle size={16} className="flex-shrink-0 text-rose-400" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast ต้องใช้ภายใน <ToastProvider>");
  return ctx;
}