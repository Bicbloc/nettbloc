/**
 * Navigation mobile en bas de page
 * Menu simplifié avec 4 onglets principaux
 */

import { useState } from "react";
import { 
  Layers, Bed, UserIcon, MoreHorizontal,
  Key, AlertTriangle, FileText, Brain, Archive, 
  ClipboardCheck, Package, Repeat, TicketCheck
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TabValue = 
  | 'overview' | 'rooms' | 'assignment' | 'access-codes' 
  | 'linen' | 'incidents' | 'reports' | 'training' 
  | 'archives' | 'inspections' | 'lost-found' | 'templates' | 'tickets';

interface MobileBottomNavProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  isPremium: boolean;
}

interface NavItem {
  value: TabValue;
  labelKey: keyof ReturnType<typeof useLanguage>['t']['dashboard'];
  shortLabelKey: keyof ReturnType<typeof useLanguage>['t']['dashboard'];
  icon: React.ReactNode;
  premium?: boolean;
}

export function MobileBottomNav({ activeTab, onTabChange, isPremium }: MobileBottomNavProps) {
  const { t } = useLanguage();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Onglets principaux visibles en permanence
  const primaryItems: NavItem[] = [
    { value: 'overview', labelKey: 'overview', shortLabelKey: 'home', icon: <Layers className="h-5 w-5" /> },
    { value: 'rooms', labelKey: 'rooms', shortLabelKey: 'rooms', icon: <Bed className="h-5 w-5" /> },
    { value: 'assignment', labelKey: 'assignment', shortLabelKey: 'team', icon: <UserIcon className="h-5 w-5" /> },
  ];

  // Menu "Plus" organisé par catégorie
  const moreItems: { categoryKey: keyof ReturnType<typeof useLanguage>['t']['dashboard']; items: NavItem[] }[] = [
    {
      categoryKey: 'operations',
      items: [
        { value: 'access-codes', labelKey: 'accessCodes', shortLabelKey: 'codes', icon: <Key className="h-5 w-5" />, premium: true },
        { value: 'incidents', labelKey: 'incidents', shortLabelKey: 'incidents', icon: <AlertTriangle className="h-5 w-5" />, premium: true },
        { value: 'inspections', labelKey: 'inspections', shortLabelKey: 'inspections', icon: <ClipboardCheck className="h-5 w-5" />, premium: true },
      ]
    },
    {
      categoryKey: 'inventory',
      items: [
        { value: 'linen', labelKey: 'linenInventory', shortLabelKey: 'linenShort', icon: <span className="text-lg">🧺</span>, premium: true },
        { value: 'lost-found', labelKey: 'lostAndFound', shortLabelKey: 'found', icon: <Package className="h-5 w-5" />, premium: true },
      ]
    },
    {
      categoryKey: 'tools',
      items: [
        { value: 'templates', labelKey: 'reports', shortLabelKey: 'reports', icon: <Repeat className="h-5 w-5" /> },
        { value: 'reports', labelKey: 'reports', shortLabelKey: 'reports', icon: <FileText className="h-5 w-5" /> },
        { value: 'archives', labelKey: 'archives', shortLabelKey: 'archives', icon: <Archive className="h-5 w-5" /> },
        // Training IA retiré — accessible via Gestion des chambres > Config avancée
      ]
    }
  ];

  const handleTabChange = (tab: TabValue) => {
    onTabChange(tab);
    setIsMoreOpen(false);
  };

  const allSecondaryItems = moreItems.flatMap(cat => cat.items);
  const isSecondaryActive = allSecondaryItems.some(item => item.value === activeTab);

  const getLabel = (key: keyof ReturnType<typeof useLanguage>['t']['dashboard']) => {
    return t.dashboard[key] as string;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <nav className="flex items-center justify-around px-2 py-2">
        {primaryItems.map((item) => (
          <button
            key={item.value}
            onClick={() => handleTabChange(item.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
              activeTab === item.value 
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{getLabel(item.shortLabelKey)}</span>
          </button>
        ))}
        
        {/* More button */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isSecondaryActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t.dashboard.more}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[65vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle>{t.dashboard.menu}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full pb-8">
              <div className="space-y-6 px-2">
                {moreItems.map((category) => (
                  <div key={category.categoryKey}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {getLabel(category.categoryKey)}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {category.items.map((item) => (
                        <button
                          key={item.value}
                          onClick={() => handleTabChange(item.value)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",
                            activeTab === item.value 
                              ? "bg-primary text-primary-foreground shadow-lg" 
                              : "bg-muted/50 hover:bg-muted",
                            item.premium && !isPremium && "opacity-60"
                          )}
                        >
                          {item.icon}
                          <span className="text-xs font-medium text-center">{getLabel(item.shortLabelKey)}</span>
                          {item.premium && !isPremium && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0">PRO</Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
