
import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import { HousekeepingProvider } from "./contexts/HousekeepingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { HotelProvider } from "./contexts/HotelContext";
import { HousekeeperAuthProvider } from "./contexts/HousekeeperAuthContext";
import { TechnicianAuthProvider } from "./contexts/TechnicianAuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AppBoot } from "./components/AppBoot";
import { ConnectionDebugPanel } from "./components/debug/ConnectionDebugPanel";
import { ImpersonationBanner } from "./components/admin/ImpersonationBanner";
import GlobalNotices from "./components/GlobalNotices";
import { LanguageProvider } from "./contexts/LanguageContext";

// Lazy-loaded pages
const EstablishmentAuth = React.lazy(() => import("./pages/EstablishmentAuth"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Admin = React.lazy(() => import("./pages/Admin"));
const RoomRegistry = React.lazy(() => import("./pages/RoomRegistry"));
const Order = React.lazy(() => import("./pages/Order"));
const Invoices = React.lazy(() => import("./pages/Invoices"));
const PlanSelection = React.lazy(() => import("./pages/PlanSelection"));
const Success = React.lazy(() => import("./pages/Success"));
const Team = React.lazy(() => import("./pages/Team"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const LegalPage = React.lazy(() => import("./pages/LegalPage"));
const ActivateAccount = React.lazy(() => import("./pages/ActivateAccount"));
const HousekeeperAuth = React.lazy(() => import("./pages/HousekeeperAuth"));
const HousekeeperSignup = React.lazy(() => import("./pages/HousekeeperSignup"));
const HousekeeperHotels = React.lazy(() => import("./pages/HousekeeperHotels"));
const GuestMode = React.lazy(() => import("./pages/GuestMode"));
const HousekeeperProfile = React.lazy(() => import("./pages/HousekeeperProfile"));
const HousekeeperWorkSimple = React.lazy(() => import("./components/HousekeeperWorkSimple").then(m => ({ default: m.HousekeeperWorkSimple })));
const TechnicianLogin = React.lazy(() => import("./pages/TechnicianLogin"));
const TechnicianSignup = React.lazy(() => import("./pages/TechnicianSignup"));
const TechnicianDashboard = React.lazy(() => import("./pages/TechnicianDashboard"));
const TechnicianHotels = React.lazy(() => import("./pages/TechnicianHotels"));
const TechnicianWork = React.lazy(() => import("./pages/TechnicianWork"));
const TechnicianProfile = React.lazy(() => import("./pages/TechnicianProfile"));
const GovernessAuth = React.lazy(() => import("./pages/GovernessAuth"));
const GovernessDashboard = React.lazy(() => import("./pages/GovernessDashboard"));
const GovernessHotels = React.lazy(() => import("./pages/GovernessHotels"));
const HousekeeperAccessPage = React.lazy(() => import("./pages/access/HousekeeperAccessPage"));
const GovernessAccessPage = React.lazy(() => import("./pages/access/GovernessAccessPage"));
const TechnicianAccessPage = React.lazy(() => import("./pages/access/TechnicianAccessPage"));
const NettoCountAuth = React.lazy(() => import("./pages/netto-count/NettoCountAuth"));
const NettoCountSetup = React.lazy(() => import("./pages/netto-count/NettoCountSetup"));
const NettoCountScan = React.lazy(() => import("./pages/netto-count/NettoCountScan"));
const NettoCountResults = React.lazy(() => import("./pages/netto-count/NettoCountResults"));
const NettoCountHistory = React.lazy(() => import("./pages/netto-count/NettoCountHistory"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
    },
  },
});

// Quand la session est rafraîchie (retour au premier plan), recharger les données
if (typeof window !== 'undefined') {
  window.addEventListener('auth:session_refreshed', () => {
    queryClient.invalidateQueries();
  });
}

const App = () => (
  <AppBoot>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AuthProvider>
            <HotelProvider>
              <HousekeeperAuthProvider>
                <TechnicianAuthProvider>
                  <NotificationProvider>
                    <HousekeepingProvider>
                      <TooltipProvider>
                        <Toaster />
                        <Sonner />
                        <GlobalNotices />
                        {import.meta.env.DEV && <ConnectionDebugPanel />}
                        <div className="flex flex-col min-h-screen">
                          <ImpersonationBanner />
                          <div className="flex-grow">
                            <BrowserRouter>
                            <Suspense fallback={<PageLoader />}>
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/landing" element={<Landing />} />
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/reset-password" element={<ResetPassword />} />
                              <Route path="/auth/establishment" element={<EstablishmentAuth />} />
                              <Route path="/guest" element={<GuestMode />} />
                              <Route path="/plan-selection" element={<PlanSelection />} />
                              <Route path="/plans" element={<PlanSelection />} />
                              <Route path="/success" element={<Success />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/reports" element={<Reports />} />
                              <Route path="/admin" element={<Admin />} />
                              <Route path="/room-registry" element={<RoomRegistry />} />
                              <Route path="/equipment" element={<Navigate to="/room-registry" replace />} />
                              <Route path="/invoices" element={<Invoices />} />
                              <Route path="/team" element={<Team />} />
                              <Route path="/order" element={<Order />} />
                              {/* Access request pages */}
                              <Route path="/access/housekeepers" element={<HousekeeperAccessPage />} />
                              <Route path="/access/governesses" element={<GovernessAccessPage />} />
                              <Route path="/access/technicians" element={<TechnicianAccessPage />} />
                              <Route path="/housekeeper/login" element={<Navigate to="/housekeeper/auth" replace />} />
                              <Route path="/housekeeper/auth" element={<HousekeeperAuth />} />
                              <Route path="/housekeeper/signup" element={<HousekeeperSignup />} />
                              <Route path="/housekeeper/hotels" element={<HousekeeperHotels />} />
                              <Route path="/housekeeper/work" element={<HousekeeperWorkSimple />} />
                              <Route path="/housekeeper/mobile" element={<Navigate to="/housekeeper/work" replace />} />
                              <Route path="/housekeeper/profile" element={<HousekeeperProfile />} />
                              <Route path="/technician/signup" element={<TechnicianSignup />} />
                              <Route path="/technician/login" element={<TechnicianLogin />} />
                              <Route path="/technician/hotels" element={<TechnicianHotels />} />
                              <Route path="/technician/work" element={<TechnicianWork />} />
                              <Route path="/technician/profile" element={<TechnicianProfile />} />
                              <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
                              <Route path="/governess/auth" element={<GovernessAuth />} />
                              <Route path="/governess/hotels" element={<GovernessHotels />} />
                              <Route path="/governess/dashboard" element={<GovernessDashboard />} />
                              {/* Netto Count App Routes */}
                              <Route path="/netto-count" element={<Navigate to="/netto-count/auth" replace />} />
                              <Route path="/netto-count/auth" element={<NettoCountAuth />} />
                              <Route path="/netto-count/setup" element={<NettoCountSetup />} />
                              <Route path="/netto-count/scan" element={<NettoCountScan />} />
                              <Route path="/netto-count/results/:scanId" element={<NettoCountResults />} />
                              <Route path="/netto-count/history" element={<NettoCountHistory />} />
                              {/* Legal pages */}
                              <Route path="/legal/:slug" element={<LegalPage />} />
                              {/* Account activation */}
                              <Route path="/activate-account" element={<ActivateAccount />} />
                              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                            </Suspense>
                          </BrowserRouter>
                        </div>
                      </div>
                      </TooltipProvider>
                    </HousekeepingProvider>
                  </NotificationProvider>
                </TechnicianAuthProvider>
              </HousekeeperAuthProvider>
            </HotelProvider>
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </LanguageProvider>
  </AppBoot>
);

export default App;
