import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-background via-background to-secondary/10", className)}>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        {children}
      </div>
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function DashboardSection({ 
  title, 
  description, 
  children, 
  className,
  actions 
}: DashboardSectionProps) {
  return (
    <Card className={cn("shadow-lg", className)}>
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}

export function DashboardGrid({ children, className, cols = 3 }: DashboardGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={cn(
      "grid gap-4 md:gap-6",
      gridClasses[cols],
      className
    )}>
      {children}
    </div>
  );
}
