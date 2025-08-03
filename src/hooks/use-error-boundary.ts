import { useState, useCallback } from 'react';
import { toast } from './use-toast';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface AppError {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

export function useErrorBoundary() {
  const [errors, setErrors] = useState<AppError[]>([]);

  const logError = useCallback((error: Error, errorInfo?: ErrorInfo) => {
    const appError: AppError = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    setErrors(prev => [...prev, appError].slice(-10)); // Keep last 10 errors

    // Show toast for critical errors
    if (!error.message.includes('ChunkLoadError')) {
      toast({
        variant: "destructive",
        title: "Erreur application",
        description: "Une erreur inattendue s'est produite. L'équipe technique a été notifiée.",
      });
    }

    console.error('App Error:', appError);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const reportError = useCallback((error: Error, context?: string) => {
    logError(error, context ? { componentStack: context } : undefined);
  }, [logError]);

  return {
    errors,
    logError,
    clearErrors,
    reportError,
  };
}