
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BicblocFooter } from "./components/BicblocBranding";

// Create a simple blank container for the top of the page
const HeaderSpace = () => (
  <div className="container mx-auto py-4">
    {/* Titre supprimé - espace réservé uniquement */}
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="flex flex-col min-h-screen">
        <HeaderSpace />
        <div className="flex-grow">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
        <div className="container mx-auto">
          <BicblocFooter />
        </div>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
