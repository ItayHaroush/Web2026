import React, { createContext, useContext, useState, useCallback } from 'react';
import { FaCheckCircle, FaTimesCircle, FaShoppingBag } from 'react-icons/fa';

/**
 * Context להצגת הודעות Toast
 */

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

        // הסר אחרי 3 שניות
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] space-y-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-sm font-medium
              animate-[slideDown_0.4s_ease-out] border-2
              transition-all duration-300
              ${toast.type === 'success'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-blue-300'
                                : 'bg-gradient-to-r from-red-400 to-pink-400 text-white border-red-200'}
            `}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                                {toast.type === 'success' ? (
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                        <FaShoppingBag className="w-4 h-4" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                        <FaTimesCircle className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-bold">{toast.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
