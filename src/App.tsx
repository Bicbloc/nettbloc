
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import EstablishmentAuth from "./pages/EstablishmentAuth";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import RoomRegistry from "./pages/RoomRegistry";
import Invoices from "./pages/Invoices";
import PlanSelection from "./pages/PlanSelection";
import Success from "./pages/Success";
import { HousekeepingProvider } from "./contexts/HousekeepingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { HotelProvider } from "./contexts/HotelContext";
import { HousekeeperAuthProvider } from "./contexts/HousekeeperAuthContext";
import HousekeeperAuth from "./pages/HousekeeperAuth";
import HousekeeperSignup from "./pages/HousekeeperSignup";
import HousekeeperHotels from "./pages/HousekeeperHotels";
import GuestMode from "./pages/GuestMode";
import HousekeeperProfile from "./pages/HousekeeperProfile";
import TechnicianLogin from "./pages/TechnicianLogin";
import TechnicianSignup from "./pages/TechnicianSignup";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import GovernessAuth from "./pages/GovernessAuth";
import GovernessDashboard from "./pages/GovernessDashboard";
import { TechnicianAuthProvider } from "./contexts/TechnicianAuthContext";
import { HousekeeperWorkSimple } from "./components/HousekeeperWorkSimple";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AppBoot } from "./components/AppBoot";
import { ConnectionDebugPanel } from "./components/debug/ConnectionDebugPanel";
import { LanguageProvider } from "./contexts/LanguageContext";

// Netto Count App
import NettoCountAuth from "./pages/netto-count/NettoCountAuth";
import NettoCountSetup from "./pages/netto-count/NettoCountSetup";
import NettoCountScan from "./pages/netto-count/NettoCountScan";
import NettoCountResults from "./pages/netto-count/NettoCountResults";
import NettoCountHistory from "./pages/netto-count/NettoCountHistory";

const queryClient = new QueryClient();

const App = () => (
  <AppBoot>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HotelProvider>
            <HousekeeperAuthProvider>
              <TechnicianAuthProvider>
                <HousekeepingProvider>
                  <NotificationProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <ConnectionDebugPanel />
                      <div className="flex flex-col min-h-screen">
                        <div className="flex-grow">
                          <BrowserRouter>
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/auth/establishment" element={<EstablishmentAuth />} />
                              <Route path="/guest" element={<GuestMode />} />
                              <Route path="/plan-selection" element={<PlanSelection />} />
                              <Route path="/plans" element={<PlanSelection />} />
                              <Route path="/success" element={<Success />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/reports" element={<Reports />} />
                              <Route path="/admin" element={<Admin />} />
                              <Route path="/room-registry" element={<RoomRegistry />} />
                              <Route path="/invoices" element={<Invoices />} />
                              <Route path="/housekeeper/login" element={<Navigate to="/housekeeper/auth" replace />} />
                              <Route path="/housekeeper/auth" element={<HousekeeperAuth />} />
                              <Route path="/housekeeper/signup" element={<HousekeeperSignup />} />
                              <Route path="/housekeeper/hotels" element={<HousekeeperHotels />} />
                              <Route path="/housekeeper/work" element={<HousekeeperWorkSimple />} />
                              <Route path="/housekeeper/mobile" element={<Navigate to="/housekeeper/work" replace />} />
                              <Route path="/housekeeper/profile" element={<HousekeeperProfile />} />
                              <Route path="/technician/signup" element={<TechnicianSignup />} />
                              <Route path="/technician/login" element={<TechnicianLogin />} />
                              <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
                              <Route path="/governess/auth" element={<GovernessAuth />} />
                              <Route path="/governess/dashboard" element={<GovernessDashboard />} />
                              {/* Netto Count App Routes */}
                              <Route path="/netto-count" element={<Navigate to="/netto-count/auth" replace />} />
                              <Route path="/netto-count/auth" element={<NettoCountAuth />} />
                              <Route path="/netto-count/setup" element={<NettoCountSetup />} />
                              <Route path="/netto-count/scan" element={<NettoCountScan />} />
                              <Route path="/netto-count/results/:scanId" element={<NettoCountResults />} />
                              <Route path="/netto-count/history" element={<NettoCountHistory />} />
                              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </BrowserRouter>
                        </div>
                      </div>
                    </TooltipProvider>
                  </NotificationProvider>
                </HousekeepingProvider>
              </TechnicianAuthProvider>
            </HousekeeperAuthProvider>
          </HotelProvider>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  </AppBoot>
);

export default App;
