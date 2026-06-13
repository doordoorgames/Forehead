import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Room from "@/pages/room";
import LanguageSelect from "@/pages/language-select";
import ModeSelect from "@/pages/mode-select";
import CyberpunkBackground from "@/components/CyberpunkBackground";
import { LanguageProvider } from "@/context/LanguageContext";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const roomCode = location.startsWith('/room/') ? location.split('/room/')[1]?.toUpperCase() : null;
  const isDykmRoom = !!roomCode && sessionStorage.getItem(`fg_roomMode_${roomCode}`) === 'dykm';
  const isCharadesRoom = !!roomCode && sessionStorage.getItem(`fg_roomMode_${roomCode}`) === 'charades';
  const showCyberpunk = !location.startsWith('/character') && !location.startsWith('/dykm') && !location.startsWith('/doyouknowme') && !location.startsWith('/charades') && !isDykmRoom && !isCharadesRoom;

  return (
    <>
      {showCyberpunk && <CyberpunkBackground />}
      <Switch>
        <Route path="/" component={LanguageSelect} />
        <Route path="/mode" component={ModeSelect} />
        <Route path="/forehead">{() => <Home mode="forehead" />}</Route>
        <Route path="/character">{() => <Home mode="character" />}</Route>
        <Route path="/charades">{() => <Home mode="charades" />}</Route>
        <Route path="/dykm">{() => <Home mode="dykm" />}</Route>
        <Route path="/doyouknowme">{() => <Home mode="dykm" />}</Route>
        <Route path="/home">{() => <Redirect to="/mode" />}</Route>
        <Route path="/admin" component={Admin} />
        <Route path="/room/:code" component={Room} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
