import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Roleta from "./pages/Roleta.tsx";
import Admin from "./pages/Admin.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Referral from "./pages/Referral.tsx";
import Registration from "./pages/Registration.tsx";
import Influencer from "./pages/Influencer.tsx";
import Deposit from "./pages/Deposit.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/ref/:code" element={<Referral />} />
          <Route path="/gorjeta" element={<Registration />} />
          <Route path="/influencer" element={<Influencer />} />
          <Route path="/dep" element={<Deposit />} />
          <Route path="/:slug" element={<Roleta />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
