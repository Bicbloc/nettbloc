import { useState, useEffect } from 'react';
import { useConnectionStatus } from './use-connection-status';
import { useErrorBoundary } from './use-error-boundary';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
}

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  connection: boolean;
  performance: 'good' | 'slow' | 'critical';
  errors: number;
  lastCheck: number;
}

export function useAppHealth() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
  });
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    overall: 'healthy',
    connection: true,
    performance: 'good',
    errors: 0,
    lastCheck: Date.now(),
  });

  const { isConnected, lastPingTime } = useConnectionStatus();
  const { errors } = useErrorBoundary();

  // Monitor performance
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          setMetrics(prev => ({
            ...prev,
            loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
          }));
        }
      }
    });

    observer.observe({ entryTypes: ['navigation'] });

    return () => observer.disconnect();
  }, []);

  // Monitor memory usage (if available)
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // MB
        }));
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate overall health
  useEffect(() => {
    const now = Date.now();
    let overall: HealthStatus['overall'] = 'healthy';
    let performance: HealthStatus['performance'] = 'good';

    // Check performance
    if (lastPingTime && lastPingTime > 5000) {
      performance = 'critical';
      overall = 'critical';
    } else if (lastPingTime && lastPingTime > 2000) {
      performance = 'slow';
      overall = 'warning';
    }

    // Check errors
    const recentErrors = errors.filter(e => now - e.timestamp < 300000); // Last 5 minutes
    if (recentErrors.length > 5) {
      overall = 'critical';
    } else if (recentErrors.length > 2) {
      overall = 'warning';
    }

    // Check connection
    if (!isConnected) {
      overall = 'critical';
    }

    setHealthStatus({
      overall,
      connection: isConnected,
      performance,
      errors: recentErrors.length,
      lastCheck: now,
    });
  }, [isConnected, lastPingTime, errors]);

  return {
    metrics,
    healthStatus,
    isHealthy: healthStatus.overall === 'healthy',
  };
}