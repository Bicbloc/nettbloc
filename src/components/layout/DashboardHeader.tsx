/**
 * Header du dashboard - version épurée
 * Affiche le logo, statut et actions principales
 */

import { Building, UserIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { UpgradeButton } from "@/components/UpgradeButton";
import { NotificationBell } from "@/components/NotificationBell";
import UserMenu from "@/components/UserMenu";
import { DayClosureControl } from "@/components/DayClosureControl";
import { GuidedDistributionWizard } from "@/components/GuidedDistributionWizard";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  hotelName?: string;
  hotelCode?: string;
  isPremium: boolean;
  isFree: boolean;
  isGuestMode: boolean;
  isConnected: boolean;
  currentHotelId: string | null;
  subscriptionLoading: boolean;
  onStartWorkflow: () => void;
  isMobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export function DashboardHeader({
  hotelName,
  hotelCode,
  isPremium,
  isFree,
  isGuestMode,
  isConnected,
  currentHotelId,
  subscriptionLoading,
  onStartWorkflow,
  isMobileMenuOpen,
  onMobileMenuToggle
}: DashboardHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Left: Logo & Hotel info */}
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMobileMenuToggle}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex items-center gap-3">
              <img src="/Nettobloc.png" alt="Nettobloc" className="h-10 w-10 rounded-xl object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-display font-bold tracking-tight">
                  Nettobloc
                </h1>
                <div className="flex items-center gap-2 -mt-0.5">
                  {isGuestMode && (
                    <Badge variant="outline" className="text-[10px] h-4">{t.dashboard.guestMode}</Badge>
                  )}
                  {!subscriptionLoading && (
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "text-[10px] h-4 border-0",
                        isPremium 
                          ? "bg-gradient-premium text-premium-foreground" 
                          : "bg-gradient-freemium text-freemium-foreground"
                      )}
                    >
                      {isPremium ? "Premium" : "Free"}
                    </Badge>
                  )}
                  {hotelName && (
                    <span className="text-[10px] text-muted-foreground hidden lg:inline">
                      {hotelName} {hotelCode && `• ${hotelCode}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Connection status - compact */}
            <Badge 
              variant={isConnected ? "default" : "destructive"} 
              className="hidden sm:flex h-7 gap-1.5 text-xs"
            >
              <div className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              )} />
              <span className="hidden md:inline">
                {isConnected ? t.dashboard.realtimeActive : t.dashboard.disconnected}
              </span>
            </Badge>

            {/* Upgrade button */}
            {isFree && (
              <UpgradeButton 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs hidden sm:flex" 
              />
            )}

            {/* Quick actions - hidden on mobile */}
            <div className="hidden lg:flex items-center gap-2">
              <GuidedDistributionWizard onStartWorkflow={onStartWorkflow} />
              <Button asChild size="sm" variant="outline" className="h-8">
                <a href="/housekeeper/auth">
                  <UserIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden xl:inline">{t.housekeeper.staffArea}</span>
                  <span className="xl:hidden">Staff</span>
                </a>
              </Button>
              <DayClosureControl
                hotelId={currentHotelId || ''}
                onReportClosed={() => window.location.reload()}
              />
            </div>

            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
