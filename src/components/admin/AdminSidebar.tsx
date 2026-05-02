import {
  LayoutDashboard, Users, Hotel, Monitor, Key, UserPlus, AlertTriangle,
  Database, CreditCard, Gift, Smartphone, FileText, Bell, Activity,
  Megaphone, Settings,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export type AdminSection =
  | 'dashboard' | 'users' | 'sessions' | 'access-codes' | 'housekeeper-requests'
  | 'hotels' | 'incidents' | 'training'
  | 'plans' | 'promos' | 'phone-orders' | 'invoices'
  | 'tickets' | 'audit' | 'legal' | 'banners' | 'system';

interface Item { id: AdminSection; label: string; icon: any; badge?: string; }

const groups: { label: string; items: Item[] }[] = [
  {
    label: 'Vue d\'ensemble',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Utilisateurs & Accès',
    items: [
      { id: 'users', label: 'Utilisateurs', icon: Users },
      { id: 'sessions', label: 'Sessions', icon: Monitor },
      { id: 'access-codes', label: 'Codes d\'accès', icon: Key },
      { id: 'housekeeper-requests', label: 'Demandes FdC', icon: UserPlus, badge: '!' },
    ],
  },
  {
    label: 'Établissements',
    items: [
      { id: 'hotels', label: 'Hôtels', icon: Hotel },
      { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
      { id: 'training', label: 'IA Training', icon: Database },
    ],
  },
  {
    label: 'Abonnements',
    items: [
      { id: 'plans', label: 'Plans & Tarifs', icon: CreditCard },
      { id: 'promos', label: 'Codes promo', icon: Gift },
      { id: 'phone-orders', label: 'Téléphones', icon: Smartphone },
      { id: 'invoices', label: 'Factures', icon: FileText },
    ],
  },
  {
    label: 'Support & Système',
    items: [
      { id: 'tickets', label: 'Tickets', icon: Bell },
      { id: 'audit', label: 'Journal d\'audit', icon: Activity },
      { id: 'banners', label: 'Bannières', icon: Megaphone },
      { id: 'legal', label: 'Pages légales', icon: FileText },
      { id: 'system', label: 'Système', icon: Settings },
    ],
  },
];

interface AdminSidebarProps {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
}

export function AdminSidebar({ active, onChange }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map(group => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      onClick={() => onChange(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.label}
                          {item.badge && (
                            <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;
