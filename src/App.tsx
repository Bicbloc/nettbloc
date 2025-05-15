
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmailsPage from "./pages/Emails";
import { BicblocFooter } from "./components/BicblocBranding";

// Minimal header space with no title
const HeaderSpace = () => (
  <div className="container mx-auto pt-1">
    {/* Empty space - no title */}
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
        {/* Footer positioned at the top, before the main content, with increased width and less padding */}
        <div className="container mx-auto mb-2 px-0">
          <BicblocFooter />
        </div>
        <div className="flex-grow">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/emails" element={<EmailsPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
