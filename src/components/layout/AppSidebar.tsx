/**
 * Sidebar de navigation principale
 * Regroupe les onglets en catégories logiques
 */

import { useState } from "react";
import { 
  Layers, Bed, UserIcon, Key, AlertTriangle, FileText, 
  Brain, Archive, Mail, ClipboardCheck, Package, 
  ChevronDown, ChevronRight, Building, Settings,
  Home, Users, BarChart3, Wrench
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TabValue = 
  | 'overview' | 'rooms' | 'assignment' | 'access-codes' 
  | 'linen' | 'incidents' | 'reports' | 'training' 
  | 'archives' | 'invitations' | 'inspections' | 'lost-found';

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  premium?: boolean;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface AppSidebarProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  isPremium: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({ 
  activeTab, 
  onTabChange, 
  isPremium,
  isCollapsed = false,
  onCollapsedChange 
}: AppSidebarProps) {
  const { t } = useLanguage();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    main: true,
    operations: true,
    management: false,
    config: false
  });

  const categories: NavCategory[] = [
    {
      id: 'main',
      label: 'Principal',
      icon: <Home className="h-4 w-4" />,
      defaultOpen: true,
      items: [
        { value: 'overview', label: t.dashboard.overview, icon: <Layers className="h-5 w-5" /> },
        { value: 'rooms', label: t.dashboard.rooms, icon: <Bed className="h-5 w-5" /> },
        { value: 'assignment', label: t.dashboard.assignment, icon: <UserIcon className="h-5 w-5" /> },
      ]
    },
    {
      id: 'operations',
      label: 'Opérations',
      icon: <BarChart3 className="h-4 w-4" />,
      defaultOpen: true,
      items: [
        { 
          value: 'access-codes', 
          label: t.dashboard.accessCodes, 
          icon: <Key className="h-5 w-5" />,
          badge: <Badge variant="destructive" className="ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse">!</Badge>,
          premium: true
        },
        { value: 'incidents', label: t.dashboard.incidents, icon: <AlertTriangle className="h-5 w-5" />, premium: true },
        { value: 'linen', label: t.dashboard.linenInventory, icon: <span className="text-lg">🧺</span>, premium: true },
        { value: 'lost-found', label: 'Objets Trouvés', icon: <Package className="h-5 w-5" />, premium: true },
      ]
    },
    {
      id: 'management',
      label: 'Gestion',
      icon: <Users className="h-4 w-4" />,
      items: [
        { value: 'reports', label: t.dashboard.reports, icon: <FileText className="h-5 w-5" /> },
        { value: 'invitations', label: t.dashboard.invitations, icon: <Mail className="h-5 w-5" />, premium: true },
        { value: 'inspections', label: t.dashboard.inspections, icon: <ClipboardCheck className="h-5 w-5" />, premium: true },
        { value: 'archives', label: t.dashboard.archives, icon: <Archive className="h-5 w-5" /> },
      ]
    },
    {
      id: 'config',
      label: 'Configuration',
      icon: <Wrench className="h-4 w-4" />,
      items: [
        { value: 'training', label: t.dashboard.aiTraining, icon: <Brain className="h-5 w-5" /> },
      ]
    }
  ];

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const isItemActive = (value: TabValue) => activeTab === value;
  
  const getCategoryForTab = (tab: TabValue): string | undefined => {
    for (const cat of categories) {
      if (cat.items.some(item => item.value === tab)) {
        return cat.id;
      }
    }
    return undefined;
  };

  // Auto-open category containing active tab
  const activeCategory = getCategoryForTab(activeTab);

  return (
    <div className={cn(
      "hidden md:flex flex-col shrink-0 transition-all duration-300",
      isCollapsed ? "w-16" : "w-60"
    )}>
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg sticky top-4 overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          {!isCollapsed && (
            <span className="text-sm font-medium text-muted-foreground">Navigation</span>
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
          <div className="p-2 space-y-1">
            {categories.map((category) => {
              const isOpen = openCategories[category.id] || activeCategory === category.id;
              const hasActiveItem = category.items.some(item => isItemActive(item.value));

              if (isCollapsed) {
                // Mode collapsed: afficher seulement les icônes des items actifs ou premiers items
                return (
                  <div key={category.id} className="space-y-1">
                    {category.items.map((item) => (
                      <Button
                        key={item.value}
                        variant={isItemActive(item.value) ? "default" : "ghost"}
                        size="icon"
                        className={cn(
                          "w-full h-10",
                          isItemActive(item.value) && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => onTabChange(item.value)}
                        title={item.label}
                      >
                        {item.icon}
                      </Button>
                    ))}
                  </div>
                );
              }

              return (
                <Collapsible
                  key={category.id}
                  open={isOpen}
                  onOpenChange={() => toggleCategory(category.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between px-3 py-2 h-auto",
                        hasActiveItem && "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {category.icon}
                        <span className="text-sm font-medium">{category.label}</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-2 space-y-0.5 pt-1">
                    {category.items.map((item) => (
                      <Button
                        key={item.value}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2.5 h-auto text-left",
                          isItemActive(item.value) 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                            : "hover:bg-muted/50",
                          item.premium && !isPremium && "opacity-60"
                        )}
                        onClick={() => onTabChange(item.value)}
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge}
                        {item.premium && !isPremium && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">PRO</Badge>
                        )}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
