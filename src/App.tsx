
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Create the NettoBloc branding components
const NettoBlockLogo = () => (
  <div className="flex items-center">
    <h1 className="text-2xl font-bold font-poppins tracking-wider">NettoBloc</h1>
  </div>
);

const NettoBlockFooter = () => (
  <div className="text-center text-gray-600 text-sm">
    <a 
      href="https://bicbloc.eu" 
      target="_blank" 
      rel="noopener noreferrer"
      className="hover:text-gray-800 transition-colors"
    >
      <span className="font-poppins font-semibold">NettoBloc</span> - Commander un extra en trois clics
    </a>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto py-4">
          <NettoBlockLogo />
        </div>
        <div className="flex-grow">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
        <div className="container mx-auto py-4">
          <NettoBlockFooter />
        </div>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
