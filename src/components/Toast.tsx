import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

let toastIdCounter = 0;

export function useToast() {
    const [toasts, setToasts] = useState<any[]>([]);
    const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            if (timersRef.current[id]) {
                clearTimeout(timersRef.current[id]);
                delete timersRef.current[id];
            }
        }, 300);
    }, []);

    const addToast = useCallback((message: string, type = 'info', duration = 4000) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);
        timersRef.current[id] = setTimeout(() => removeToast(id), duration);
        return id;
    }, [removeToast]);

    const toastMethods = {
        success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
        error: (msg: string, dur?: number) => addToast(msg, 'error', dur || 6000),
        info: (msg: string, dur?: number) => addToast(msg, 'info', dur),
        warning: (msg: string, dur?: number) => addToast(msg, 'warning', dur || 5000),
    };

    return { toasts, removeToast, toast: toastMethods };
}

const ICON_MAP: Record<string, React.ReactNode> = {
    success: <CheckCircle size={20} className="text-[#2ea043]" />,
    error: <XCircle size={20} className="text-[#f85149]" />,
    info: <Info size={20} className="text-[#58a6ff]" />,
    warning: <AlertTriangle size={20} className="text-[#d29922]" />,
};

const COLOR_MAP: Record<string, string> = {
    success: 'bg-[#2ea043]/15 border-[#2ea043]/40 shadow-[0_0_20px_rgba(46,160,67,0.15)]',
    error: 'bg-[#f85149]/15 border-[#f85149]/40 shadow-[0_0_20px_rgba(248,81,73,0.15)]',
    info: 'bg-[#58a6ff]/15 border-[#58a6ff]/40 shadow-[0_0_20px_rgba(88,166,255,0.15)]',
    warning: 'bg-[#d29922]/15 border-[#d29922]/40 shadow-[0_0_20px_rgba(210,153,34,0.15)]',
};

const ICON_BG_MAP: Record<string, string> = {
    success: 'bg-[#2ea043]/20',
    error: 'bg-[#f85149]/20',
    info: 'bg-[#58a6ff]/20',
    warning: 'bg-[#d29922]/20',
};

export function ToastContainer({ toasts, onDismiss }: any) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-[90%] pointer-events-none">
            {toasts.map((t: any) => {
                const colors = COLOR_MAP[t.type] || COLOR_MAP.info;
                const iconBg = ICON_BG_MAP[t.type] || ICON_BG_MAP.info;
                return (
                    <div
                        key={t.id}
                        className={`pointer-events-auto cursor-pointer flex items-center gap-4 px-4 py-3.5 backdrop-blur-xl border rounded-xl transition-all duration-300 ${colors} ${t.exiting ? 'opacity-0 translate-x-8' : 'animate-toast-slide-in opacity-100 translate-x-0'}`}
                        onClick={() => onDismiss(t.id)}
                    >
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                            {ICON_MAP[t.type]}
                        </div>
                        <span className="text-[#e6edf3] text-sm font-medium leading-relaxed flex-1">
                            {t.message}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
