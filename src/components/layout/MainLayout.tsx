/**
 * Layout principal du dashboard
 * Intègre header, sidebar et contenu
 */

import { ReactNode, useState } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { AppSidebar, TabValue } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  isPremium: boolean;
  isFree: boolean;
  isGuestMode: boolean;
  isConnected: boolean;
  hotelName?: string;
  hotelCode?: string;
  currentHotelId: string | null;
  subscriptionLoading: boolean;
  onStartWorkflow: () => void;
  notificationCounts?: Partial<Record<TabValue, number>>;
}

export function MainLayout({
  children,
  activeTab,
  onTabChange,
  isPremium,
  isFree,
  isGuestMode,
  isConnected,
  hotelName,
  hotelCode,
  currentHotelId,
  subscriptionLoading,
  onStartWorkflow,
  notificationCounts
}: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardHeader
        hotelName={hotelName}
        hotelCode={hotelCode}
        isPremium={isPremium}
        isFree={isFree}
        isGuestMode={isGuestMode}
        isConnected={isConnected}
        currentHotelId={currentHotelId}
        subscriptionLoading={subscriptionLoading}
        onStartWorkflow={onStartWorkflow}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex-1 container mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <AppSidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            isPremium={isPremium}
            isCollapsed={isSidebarCollapsed}
            onCollapsedChange={setIsSidebarCollapsed}
          />

          {/* Main Content */}
          <main className={cn(
            "flex-1 min-w-0 pb-20 md:pb-0",
            // Add padding for mobile bottom nav
          )}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        isPremium={isPremium}
      />
    </div>
  );
}

// Re-export components
export { DashboardHeader } from "./DashboardHeader";
export { AppSidebar, type TabValue } from "./AppSidebar";
export { MobileBottomNav } from "./MobileBottomNav";
