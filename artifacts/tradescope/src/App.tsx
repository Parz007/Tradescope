import { useState, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/AppContext";
import { Layout } from "@/components/Layout";
import SplashScreen from "@/components/SplashScreen";
import Home from "@/pages/Home";
import Analyze from "@/pages/Analyze";
import History from "@/pages/History";
import PropFirm from "@/pages/PropFirm";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Marketplace from "@/pages/Marketplace";
import Analytics from "@/pages/Analytics";
import PriceAlerts from "@/pages/PriceAlerts";
import RiskCalculator from "@/pages/RiskCalculator";
import AICoach from "@/pages/AICoach";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/analyze" component={Analyze} />
        <Route path="/history" component={History} />
        <Route path="/propfirm" component={PropFirm} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin" component={Admin} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/alerts" component={PriceAlerts} />
        <Route path="/risk" component={RiskCalculator} />
        <Route path="/coach" component={AICoach} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
