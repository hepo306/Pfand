import { useMemo } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { RPC_URL } from "./lib/config";
import { DemoWalletAdapter } from "./lib/demoWallet";
import { AccountProvider } from "./components/account";
import { ToastProvider } from "./components/toast";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import CreateEvent from "./pages/CreateEvent";
import EventPage from "./pages/EventPage";
import ManageEvent from "./pages/ManageEvent";
import NotFound from "./pages/NotFound";

export default function App() {
  // Phantom, Solflare, Backpack etc. register themselves via Wallet Standard.
  const wallets = useMemo(() => [new DemoWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <ToastProvider>
          <AccountProvider>
            <HashRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/new" element={<CreateEvent />} />
                  <Route path="/e/:eventKey" element={<EventPage />} />
                  <Route path="/e/:eventKey/manage" element={<ManageEvent />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </HashRouter>
          </AccountProvider>
        </ToastProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
