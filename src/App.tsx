import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
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
import DepositBS from "./pages/DepositBS.tsx";
import Batalha from "./pages/Batalha.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const SlugRouter = () => {
  const { slug } = useParams<{ slug: string }>();
  if (slug && slug.startsWith('depbs=')) {
    const tag = slug.substring(6);
    return <DepositBS tag={tag} />;
  }
  if (slug && slug.startsWith('dep=')) {
    const tag = slug.substring(4);
    return <Deposit tag={tag} />;
  }
  return <Roleta />;
};

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
          <Route path="/batalha" element={<Batalha />} />
          <Route path="/:slug" element={<SlugRouter />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
