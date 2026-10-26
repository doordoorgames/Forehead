import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useEffect, useState, type ReactNode } from "react";
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
import { setBaseUrl } from "@workspace/forehead-api-client-react";
import { apiBaseUrl } from "@/lib/backend";

setBaseUrl(apiBaseUrl);

const queryClient = new QueryClient();

interface DordorAccount {
  fullName: string;
  role: "host" | "participant";
  remainingMinutes: number;
  activeSessionEndsAt: string | null;
}

function AccountChip({ account }: { account: DordorAccount }) {
  return (
    <a
      href="https://www.dordor.games/account"
      aria-label="Open account profile"
      className="fixed right-3 bottom-3 z-[101] flex max-w-[72vw] items-center gap-2 rounded-full border border-white/50 bg-black/90 px-3 py-2 text-sm font-extrabold text-white shadow-xl backdrop-blur-md"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-yellow-300 text-xs font-black text-black">
        {account.fullName?.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <span className="truncate">{account.fullName || "Account"}</span>
    </a>
  );
}

function SessionStatus({ account }: { account: DordorAccount | null }) {
  if (account?.role !== "host") return null;
  const active = !!account.activeSessionEndsAt && new Date(account.activeSessionEndsAt).getTime() > Date.now();
  const label = active
    ? `Session ends at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(account.activeSessionEndsAt!))}`
    : account.remainingMinutes > 0
      ? `${account.remainingMinutes} purchased minutes available`
      : "Session ended";
  return <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] rounded-full border border-white/40 bg-black/85 px-4 py-2 text-sm font-bold text-white shadow-xl whitespace-nowrap">{label}{!active && account.remainingMinutes <= 0 && <> · <a className="text-yellow-300 underline" href="https://www.dordor.games/pricing">Buy a plan</a></>}</div>;
}

function AccountGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    window.location.pathname.startsWith("/admin") ? "ready" : "loading",
  );
  const [account, setAccount] = useState<DordorAccount | null>(null);

  useEffect(() => {
    const update = (event: Event) => setAccount((event as CustomEvent<DordorAccount>).detail);
    window.addEventListener("dordor-account-updated", update);
    return () => window.removeEventListener("dordor-account-updated", update);
  }, []);

  useEffect(() => {
    if (status === "ready") return undefined;
    const controller = new AbortController();
    const authOrigin = apiBaseUrl.replace(/\/forehead$/, "");
    const request = (path: string, method = "GET") => fetch(`${authOrigin}${path}`, {
      method,
      credentials: "include",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    void (async () => {
      try {
        let response = await request("/api/auth/me");
        if (response.status === 401) {
          const refresh = await request("/api/auth/refresh", "POST");
          if (refresh.ok) response = await request("/api/auth/me");
        }
        if (response.status === 401 || response.status === 403) {
          setAccount(null);
          setStatus("ready");
          return;
        }
        if (!response.ok) throw new Error(`Account verification returned ${response.status}`);
        const verifiedAccount = await response.json() as DordorAccount;
        (window as typeof window & { DordorAccount?: DordorAccount }).DordorAccount = verifiedAccount;
        setAccount(verifiedAccount);
        setStatus("ready");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [status]);

  if (status === "loading") return <div className="min-h-screen grid place-items-center text-white">Verifying account...</div>;
  if (status === "error") return <div className="min-h-screen grid place-items-center text-white text-center p-6"><div><p>Unable to verify your account.</p><button className="mt-4 underline" onClick={() => setStatus("loading")}>Try again</button></div></div>;
  return <><SessionStatus account={account} />{account && <AccountChip account={account} />}{children}</>;
}

const hostedModePaths: Record<string, string> = {
  "guessyourword.dordor.games": "/forehead",
  "guessthecharacter.dordor.games": "/character",
  "charades.dordor.games": "/charades",
};

const hostedModeTitles: Record<string, string> = {
  "guessyourword.dordor.games": "Guess Your Word",
  "guessthecharacter.dordor.games": "Guess the Character",
  "charades.dordor.games": "Charades",
};

function getHostedModePath() {
  return hostedModePaths[window.location.hostname.toLowerCase()] ?? null;
}

function getPageTitle(location: string) {
  const hostname = window.location.hostname.toLowerCase();
  if (hostedModeTitles[hostname]) return hostedModeTitles[hostname];
  if (location.startsWith("/character")) return "Guess the Character";
  if (location.startsWith("/charades")) return "Charades";
  return "Guess Your Word";
}

function Router() {
  const [location] = useLocation();
  const hostedModePath = getHostedModePath();
  const roomCode = location.startsWith('/room/') ? location.split('/room/')[1]?.toUpperCase() : null;
  const isCharadesRoom = !!roomCode && sessionStorage.getItem(`fg_roomMode_${roomCode}`) === 'charades';
  const showCyberpunk = !location.startsWith('/character') && !location.startsWith('/charades') && !isCharadesRoom;

  useEffect(() => {
    document.title = getPageTitle(location);
  }, [location]);

  return (
    <>
      {showCyberpunk && <CyberpunkBackground />}
      <Switch>
        <Route path="/">{() => <LanguageSelect nextPath={hostedModePath ?? "/mode"} />}</Route>
        <Route path="/mode">{() => hostedModePath ? <Redirect to={hostedModePath} /> : <ModeSelect />}</Route>
        <Route path="/forehead">{() => <Home mode="forehead" />}</Route>
        <Route path="/character">{() => <Home mode="character" />}</Route>
        <Route path="/charades">{() => <Home mode="charades" />}</Route>
        <Route path="/home">{() => <Redirect to={hostedModePath ?? "/mode"} />}</Route>
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
              <AccountGate><Router /></AccountGate>
            </WouterRouter>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;

