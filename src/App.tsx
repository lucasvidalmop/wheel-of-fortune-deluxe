import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import LobbyHomeButton from "@/components/LobbyHomeButton";

const Index = lazy(() => import("./pages/Index.tsx"));
const Roleta = lazy(() => import("./pages/Roleta.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Referral = lazy(() => import("./pages/Referral.tsx"));
const Registration = lazy(() => import("./pages/Registration.tsx"));
const Influencer = lazy(() => import("./pages/Influencer.tsx"));
const Deposit = lazy(() => import("./pages/Deposit.tsx"));
const DepositBS = lazy(() => import("./pages/DepositBS.tsx"));
const Batalha = lazy(() => import("./pages/Batalha.tsx"));
const Resgate = lazy(() => import("./pages/Resgate.tsx"));
const Luckybox = lazy(() => import("./pages/Luckybox.tsx"));
const UpdateRegistration = lazy(() => import("./pages/UpdateRegistration.tsx"));
const Bets = lazy(() => import("./pages/Bets.tsx"));
const Lobby = lazy(() => import("./pages/Lobby.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

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
  if (slug && slug.startsWith('resgate=')) {
    const tag = slug.substring(8);
    return <Resgate tag={tag} />;
  }
  if (slug && slug.startsWith('luckybox=')) {
    const tag = slug.substring(9);
    return <Luckybox tag={tag} />;
  }
  if (slug && slug.startsWith('atualizar=')) {
    const tag = slug.substring(10);
    return <UpdateRegistration tag={tag} />;
  }
  if (slug && slug.startsWith('odds=')) {
    const tag = slug.substring(5);
    return <Bets tag={tag} />;
  }
  if (slug && slug.startsWith('lobby=')) {
    const tag = slug.substring(6);
    return <Lobby tag={tag} />;
  }
  return <Roleta />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <LobbyHomeButton />
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
