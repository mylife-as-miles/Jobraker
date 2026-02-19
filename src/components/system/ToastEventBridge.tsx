import { useEffect } from 'react';
import { useToast } from '../ui/toast';

// Listens for CustomEvent('toast', { detail: { title, description, variant } })
// and forwards to the existing toast system.
export function ToastEventBridge() {
  const { success, error, info } = useToast();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail: any = (e as CustomEvent).detail || {};
      const { title, description, variant = 'info' } = detail;
      switch (variant) {
        case 'success':
          success(title || 'Success', description);
          break;
        case 'error':
          error(title || 'Error', description);
          break;
        default:
          info(title || 'Info', description);
      }
    };
    window.addEventListener('toast', handler as any);
    return () => window.removeEventListener('toast', handler as any);
  }, [success, error, info]);
  return null;
}
