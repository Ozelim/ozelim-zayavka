"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

let listeners = [];
let counter = 0;

export function toast({ title, description, variant = "default", duration = 3500 }) {
  const id = ++counter;
  const t = { id, title, description, variant, duration };
  listeners.forEach((l) => l(t));
  return id;
}
toast.success = (title, description) => toast({ title, description, variant: "success" });
toast.error = (title, description) => toast({ title, description, variant: "destructive" });

const variantStyles = {
  default: { wrap: "border-green-100", title: "text-green-900", icon: Info, iconCls: "text-green-500" },
  success: { wrap: "border-green-200 bg-green-50", title: "text-green-800", icon: CheckCircle2, iconCls: "text-green-600" },
  destructive: { wrap: "border-red-200 bg-red-50", title: "text-red-700", icon: XCircle, iconCls: "text-red-500" },
};

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => {
        const v = variantStyles[t.variant] || variantStyles.default;
        const Icon = v.icon;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border bg-white shadow-lg px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2",
              v.wrap,
            )}
          >
            <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", v.iconCls)} />
            <div className="flex-1 min-w-0">
              <p className={cn("font-semibold text-sm", v.title)}>{t.title}</p>
              {t.description && (
                <p className="text-xs text-green-600 mt-0.5">{t.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
