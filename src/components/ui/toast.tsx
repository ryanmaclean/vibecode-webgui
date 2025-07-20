import { useState, useEffect, useCallback } from 'react';
import { X, Info, CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);



  const typeConfig = {
    info: {
      icon: <Info className="h-5 w-5" />,
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
    },
    success: {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-800',
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
    },
  };

  const { icon, bg, border, text } = typeConfig[type];

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 w-80 transition-all duration-300 transform ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className={`${bg} ${border} border-l-4 rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              {icon}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className={`text-sm font-medium ${text}`}>
                {message}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={handleClose}
                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white/30 h-1 w-full">
          <div 
            className={`h-full animate-progress ${type === 'info' ? 'bg-blue-500' : type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            data-duration={duration}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress {
          animation-name: progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          animation-duration: var(--toast-duration);
        }
      `}</style>
      <style jsx global>{`
        .animate-progress {
          --toast-duration: ${duration}ms;
        }
      `}</style>
    </div>
  );
}
