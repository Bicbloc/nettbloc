/**
 * Sidebar de navigation principale
 * Menu simplifié et intuitif
 */

import { useState, useEffect } from "react";
import { 
  Layers, Bed, UserIcon, Key, AlertTriangle, FileText, 
  Brain, Archive, ClipboardCheck, Package, 
  ChevronRight, Settings, Repeat, ShoppingCart, TicketCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export type TabValue = 
  | 'overview' | 'rooms' | 'assignment' | 'access-codes' 
  | 'linen' | 'incidents' | 'reports' | 'training' 
  | 'archives' | 'inspections' | 'lost-found' | 'templates' | 'tickets';

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  premium?: boolean;
}

interface AppSidebarProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  isPremium: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  notificationCounts?: Partial<Record<TabValue, number>>;
}

export function AppSidebar({ 
  activeTab, 
  onTabChange, 
  isPremium,
  isCollapsed = false,
  onCollapsedChange,
  notificationCounts = {}
}: AppSidebarProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Menu principal - accès rapide
  const mainItems: NavItem[] = [
    { value: 'overview', label: t.dashboard.overview, icon: <Layers className="h-5 w-5" /> },
    { value: 'rooms', label: t.dashboard.rooms, icon: <Bed className="h-5 w-5" /> },
    { value: 'assignment', label: t.dashboard.assignment, icon: <UserIcon className="h-5 w-5" /> },
  ];

  // Fonctionnalités opérationnelles
  const operationsItems: NavItem[] = [
    { value: 'access-codes', label: t.dashboard.accessCodes, icon: <Key className="h-5 w-5" />, premium: true },
    { value: 'tickets', label: 'Tickets', icon: <TicketCheck className="h-5 w-5" /> },
    { value: 'incidents', label: t.dashboard.incidents, icon: <AlertTriangle className="h-5 w-5" />, premium: true },
    { value: 'inspections', label: t.dashboard.inspections, icon: <ClipboardCheck className="h-5 w-5" />, premium: true },
  ];

  // Inventaires
  const inventoryItems: NavItem[] = [
    { value: 'linen', label: t.dashboard.linenInventory, icon: <span className="text-lg">🧺</span>, premium: true },
    { value: 'lost-found', label: t.dashboard.lostAndFound, icon: <Package className="h-5 w-5" />, premium: true },
  ];

  // Outils avancés
  const toolsItems: NavItem[] = [
    { value: 'templates', label: 'Templates', icon: <Repeat className="h-5 w-5" /> },
    { value: 'reports', label: t.dashboard.reports, icon: <FileText className="h-5 w-5" /> },
    { value: 'archives', label: t.dashboard.archives, icon: <Archive className="h-5 w-5" /> },
    // Training IA retiré de la nav — accessible via Gestion des chambres > Config avancée
  ];

  // Handle order navigation
  const handleOrderClick = () => {
    navigate('/order');
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeTab === item.value;
    const count = notificationCounts[item.value] || 0;

    if (isCollapsed) {
      return (
        <Button
          key={item.value}
          data-tour={`nav-${item.value}`}
          variant={isActive ? "default" : "ghost"}
          size="icon"
          className={cn(
            "w-full h-10 relative",
            isActive && "bg-primary text-primary-foreground"
          )}
          onClick={() => onTabChange(item.value)}
          title={item.label}
        >
          {item.icon}
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      );
    }

    return (
      <Button
        key={item.value}
        data-tour={`nav-${item.value}`}
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 px-3 py-2.5 h-auto text-left",
          isActive 
            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
            : "hover:bg-muted/50",
          item.premium && !isPremium && "opacity-60"
        )}
        onClick={() => onTabChange(item.value)}
      >
        {item.icon}
        <span className="flex-1 truncate">{item.label}</span>
        {count > 0 && (
          <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </Badge>
        )}
        {item.premium && !isPremium && count === 0 && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">PRO</Badge>
        )}
      </Button>
    );
  };

  const renderSection = (items: NavItem[], title?: string) => (
    <div className="space-y-0.5">
      {!isCollapsed && title && (
        <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
      )}
      {items.map(renderItem)}
    </div>
  );

  return (
    <div className={cn(
      "hidden md:flex flex-col shrink-0 transition-all duration-300",
      isCollapsed ? "w-16" : "w-56"
    )}>
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg sticky top-4 overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          {!isCollapsed && (
            <span className="text-sm font-semibold">{t.dashboard.menu}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCollapsedChange?.(!isCollapsed)}
          >
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed ? "" : "rotate-180"
            )} />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-2 space-y-4">
            {/* Principal */}
            {renderSection(mainItems)}
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            {/* Opérations */}
            {renderSection(operationsItems, t.dashboard.operations)}
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            {/* Inventaires */}
            {renderSection(inventoryItems, t.dashboard.inventory)}
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            {/* Outils */}
            {renderSection(toolsItems, t.dashboard.tools)}

            {!isCollapsed && <Separator className="mx-2" />}
            
            {/* Commander */}
            <div className="space-y-0.5">
              {!isCollapsed && (
                <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Commander
                </p>
              )}
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 px-3 py-2.5 h-auto text-left",
                  "hover:bg-primary/10 border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
                )}
                onClick={handleOrderClick}
              >
                <ShoppingCart className="h-5 w-5 text-primary" />
                {!isCollapsed && <span className="flex-1 truncate">Commander personnel</span>}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
