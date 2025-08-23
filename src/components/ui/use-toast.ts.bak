import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

interface UseToastReturn {
  toast: (toast: Omit<Toast, 'id'>) => void;
  toasts: Toast[];
  dismiss: (id: string) => void;
}

let toastCount = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = (++toastCount).toString();
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto dismiss after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toast, toasts, dismiss };
}

// For compatibility with shadcn/ui toast component
export { useToast as useToastHook };
export const toast = (props: Omit<Toast, 'id'>) => {
  // This is a simplified version for global toast calls
  // In a real app, you'd want to use a toast provider/context
  console.log('Toast:', props);
}; 