import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import {
  SidebarProvider, SidebarTrigger, SidebarInset,
} from '@/components/ui/sidebar';

import BackButton from '@/components/BackButton';
import { NotificationBell } from '@/components/NotificationBell';
import { AdminSidebar, type AdminSection } from '@/components/admin/AdminSidebar';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { UsersManagementPanel } from '@/components/admin/UsersManagementPanel';
import { SessionsManagementPanel } from '@/components/SessionsManagementPanel';
import { HousekeeperAccessRequests } from '@/components/HousekeeperAccessRequests';
import { EnhancedAuditLogPanel } from '@/components/admin/EnhancedAuditLogPanel';
import AdminBannersPanel from '@/components/admin/AdminBannersPanel';
import { SupportTicketsPanel } from '@/components/admin/SupportTicketsPanel';
import { PromoCodesPanel } from '@/components/admin/PromoCodesPanel';
import { PricingPlansPanel } from '@/components/admin/PricingPlansPanel';
import { LegalPagesPanel } from '@/components/admin/LegalPagesPanel';
import { PhoneOrdersPanel } from '@/components/admin/PhoneOrdersPanel';
import { InvoicesPanel } from '@/components/admin/InvoicesPanel';
import { HotelsPanel } from '@/components/admin/HotelsPanel';
import { AccessCodesPanel } from '@/components/admin/AccessCodesPanel';
import { IncidentsPanel } from '@/components/admin/IncidentsPanel';
import { TrainingPanel } from '@/components/admin/TrainingPanel';
import { SystemPanel } from '@/components/admin/SystemPanel';
import { EmailsPanel } from '@/components/admin/EmailsPanel';

const SECTION_TITLES: Record<AdminSection, string> = {
  'dashboard': 'Tableau de bord',
  'users': 'Gestion des utilisateurs',
  'sessions': 'Sessions actives',
  'access-codes': 'Codes d\'accès',
  'housekeeper-requests': 'Demandes femmes de chambre',
  'hotels': 'Établissements',
  'incidents': 'Gestion des incidents',
  'training': 'Entraînement IA',
  'plans': 'Plans & Tarifs',
  'promos': 'Codes promo',
  'phone-orders': 'Commandes téléphones',
  'invoices': 'Factures',
  'tickets': 'Tickets de support',
  'audit': 'Journal d\'audit',
  'legal': 'Pages légales',
  'banners': 'Bannières',
  'system': 'Système',
  'emails': 'Emails & Invitations',
};

const Admin = () => {
  const { user, loading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = (searchParams.get('section') as AdminSection) || 'dashboard';
  const [section, setSectionState] = useState<AdminSection>(initialSection);

  const setSection = (s: AdminSection) => {
    setSectionState(s);
    setSearchParams(s === 'dashboard' ? {} : { section: s }, { replace: true });
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { setIsSuperAdmin(false); return; }
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      if (mounted) setIsSuperAdmin(!!data);
    })();
    return () => { mounted = false; };
  }, [user?.id, loading]);

  if (loading || isSuperAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (!isSuperAdmin) {
    return (
      <Card className="m-6 max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Seuls les super administrateurs peuvent accéder à cette page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <AdminDashboard onNavigate={(s) => setSection(s as AdminSection)} />;
      case 'users': return <UsersManagementPanel />;
      case 'sessions': return <SessionsManagementPanel />;
      case 'access-codes': return <AccessCodesPanel />;
      case 'housekeeper-requests': return <HousekeeperAccessRequests />;
      case 'hotels': return <HotelsPanel />;
      case 'incidents': return <IncidentsPanel />;
      case 'training': return <TrainingPanel />;
      case 'plans': return <PricingPlansPanel />;
      case 'promos': return <PromoCodesPanel />;
      case 'phone-orders': return <PhoneOrdersPanel />;
      case 'invoices': return <InvoicesPanel />;
      case 'tickets': return <SupportTicketsPanel />;
      case 'audit': return <EnhancedAuditLogPanel />;
      case 'banners': return <AdminBannersPanel />;
      case 'legal': return <LegalPagesPanel />;
      case 'system': return <SystemPanel />;
      case 'emails': return <EmailsPanel />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar active={section} onChange={setSection} />
        <SidebarInset className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b px-4 sticky top-0 bg-background/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <BackButton />
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h1 className="font-semibold text-lg">{SECTION_TITLES[section]}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {renderSection()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Admin;
