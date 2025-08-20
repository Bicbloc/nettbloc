
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import AnalysisWorkflow from "./pages/AnalysisWorkflow";
import Admin from "./pages/Admin";
import PlanSelection from "./pages/PlanSelection";
import Success from "./pages/Success";
import { HousekeepingProvider } from "./contexts/HousekeepingContext";
import { AuthProvider } from "./contexts/AuthContext";
import { HousekeeperAuthProvider } from "./contexts/HousekeeperAuthContext";
import HousekeeperAuth from "./pages/HousekeeperAuth";
import HousekeeperDashboard from "./pages/HousekeeperDashboard";
import HousekeeperProfile from "./pages/HousekeeperProfile";
import HousekeeperWork from "./pages/HousekeeperWork";
import Housekeeper from "./pages/Housekeeper";
import HousekeeperLogin from "./pages/HousekeeperLogin";

// Components supprimés - plus de header space
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HousekeeperAuthProvider>
        <HousekeepingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/plan-selection" element={<PlanSelection />} />
                  <Route path="/success" element={<Success />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/analysis" element={<AnalysisWorkflow />} />
                   <Route path="/admin" element={<Admin />} />
            <Route path="/housekeeper/auth" element={<HousekeeperAuth />} />
            <Route path="/housekeeper/login" element={<HousekeeperLogin />} />
            <Route path="/housekeeper" element={<Housekeeper />} />
            <Route path="/housekeeper/dashboard" element={<HousekeeperDashboard />} />
            <Route path="/housekeeper/profile" element={<HousekeeperProfile />} />
            <Route path="/housekeeper/work" element={<HousekeeperWork />} />
                   {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </div>
          </div>
        </TooltipProvider>
        </HousekeepingProvider>
      </HousekeeperAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
