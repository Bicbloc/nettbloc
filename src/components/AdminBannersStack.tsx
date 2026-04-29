import React from 'react';
import { useAdminBanners } from '@/hooks/useAdminBanners';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { X, Info, Wrench, Sparkles, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { icon: any; classes: string }> = {
  info:        { icon: Info,         classes: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100' },
  maintenance: { icon: Wrench,       classes: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100' },
  promotion:   { icon: Sparkles,     classes: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100' },
  urgent:      { icon: AlertTriangle,classes: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100' },
};

export const AdminBannersStack: React.FC = () => {
  const { banners, dismiss } = useAdminBanners();
  const { language } = useLanguage();

  if (!banners.length) return null;

  return (
    <div className="w-full space-y-2 px-2 pt-2">
      {banners.map((b) => {
        const cfg = TYPE_CONFIG[b.banner_type] || TYPE_CONFIG.info;
        const Icon = cfg.icon;
        const message = language === 'en' && b.message_en ? b.message_en : b.message;
        const actionLabel = language === 'en' && b.action_label_en ? b.action_label_en : b.action_label;

        return (
          <div
            key={b.id}
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm',
              cfg.classes
            )}
          >
            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {b.title && <p className="font-semibold leading-tight">{b.title}</p>}
              <p className="text-sm leading-snug whitespace-pre-wrap">{message}</p>
              {b.action_url && actionLabel && (
                <a
                  href={b.action_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80"
                >
                  {actionLabel} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {b.is_dismissible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dismiss(b.id)}
                className="h-7 w-7 shrink-0 opacity-70 hover:opacity-100"
                aria-label={language === 'en' ? 'Dismiss' : 'Fermer'}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AdminBannersStack;
