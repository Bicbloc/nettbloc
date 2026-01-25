/**
 * Navigation mobile en bas de page
 * Affiche les onglets principaux avec accès rapide
 */

import { useState } from "react";
import { 
  Layers, Bed, UserIcon, MoreHorizontal,
  Key, AlertTriangle, FileText, Brain, Archive, 
  Mail, ClipboardCheck, Package, X
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  | 'archives' | 'invitations' | 'inspections' | 'lost-found';

interface MobileBottomNavProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  isPremium: boolean;
}

interface NavItem {
  value: TabValue;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  premium?: boolean;
}

const primaryItems: NavItem[] = [
  { value: 'overview', label: 'Vue d\'ensemble', shortLabel: 'Accueil', icon: <Layers className="h-5 w-5" /> },
  { value: 'rooms', label: 'Chambres', shortLabel: 'Chambres', icon: <Bed className="h-5 w-5" /> },
  { value: 'assignment', label: 'Affectation', shortLabel: 'Équipe', icon: <UserIcon className="h-5 w-5" /> },
];

const secondaryItems: NavItem[] = [
  { value: 'access-codes', label: 'Codes d\'accès', shortLabel: 'Codes', icon: <Key className="h-5 w-5" />, premium: true },
  { value: 'incidents', label: 'Incidents', shortLabel: 'Incidents', icon: <AlertTriangle className="h-5 w-5" />, premium: true },
  { value: 'linen', label: 'Inventaire Linge', shortLabel: 'Linge', icon: <span className="text-lg">🧺</span>, premium: true },
  { value: 'lost-found', label: 'Objets Trouvés', shortLabel: 'Trouvés', icon: <Package className="h-5 w-5" />, premium: true },
  { value: 'reports', label: 'Rapports', shortLabel: 'Rapports', icon: <FileText className="h-5 w-5" /> },
  { value: 'invitations', label: 'Invitations', shortLabel: 'Invites', icon: <Mail className="h-5 w-5" />, premium: true },
  { value: 'inspections', label: 'Inspections', shortLabel: 'Inspect.', icon: <ClipboardCheck className="h-5 w-5" />, premium: true },
  { value: 'archives', label: 'Archives', shortLabel: 'Archives', icon: <Archive className="h-5 w-5" /> },
  { value: 'training', label: 'Entraînement IA', shortLabel: 'IA', icon: <Brain className="h-5 w-5" /> },
];

export function MobileBottomNav({ activeTab, onTabChange, isPremium }: MobileBottomNavProps) {
  const { t } = useLanguage();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleTabChange = (tab: TabValue) => {
    onTabChange(tab);
    setIsMoreOpen(false);
  };

  const isSecondaryActive = secondaryItems.some(item => item.value === activeTab);

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
            <span className="text-[10px] font-medium">{item.shortLabel}</span>
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
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle>Menu complet</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full pb-8">
              <div className="grid grid-cols-3 gap-3 px-2">
                {secondaryItems.map((item) => (
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
                    <span className="text-xs font-medium text-center">{item.shortLabel}</span>
                    {item.premium && !isPremium && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0">PRO</Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
