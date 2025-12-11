
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
import PlanSelection from "./pages/PlanSelection";
import Success from "./pages/Success";
import { HousekeepingProvider } from "./contexts/HousekeepingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { HousekeeperAuthProvider } from "./contexts/HousekeeperAuthContext";
import HousekeeperLogin from "./pages/HousekeeperLogin";
import HousekeeperAuth from "./pages/HousekeeperAuth";
import HousekeeperSignup from "./pages/HousekeeperSignup";
import HousekeeperHotels from "./pages/HousekeeperHotels";
import GuestMode from "./pages/GuestMode";
import HousekeeperProfile from "./pages/HousekeeperProfile";
import HousekeeperMobile from "./pages/HousekeeperMobile";
import TechnicianLogin from "./pages/TechnicianLogin";
import TechnicianSignup from "./pages/TechnicianSignup";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import { TechnicianAuthProvider } from "./contexts/TechnicianAuthContext";
import { HousekeeperWorkSimple } from "./components/HousekeeperWorkSimple";
import { NotificationProvider } from "./contexts/NotificationContext";

// Components supprimés - plus de header space
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HousekeeperAuthProvider>
        <TechnicianAuthProvider>
          <HousekeepingProvider>
            <NotificationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <div className="flex flex-col min-h-screen">
                  <div className="flex-grow">
                    <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/establishment" element={<EstablishmentAuth />} />
                    <Route path="/guest" element={<GuestMode />} />
                    <Route path="/plan-selection" element={<PlanSelection />} />
                    <Route path="/success" element={<Success />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/room-registry" element={<RoomRegistry />} />
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
