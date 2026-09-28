import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GithubLogo } from "@phosphor-icons/react";
import { WalletMenu } from "./WalletMenu";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Pfand home">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-[17px] font-bold text-accent-ink">P</span>
      <span className="text-lg font-semibold tracking-tight">Pfand</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link to="/new" className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:block">
              New event
            </Link>
            <span className="hidden rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn sm:inline">Devnet</span>
            <WalletMenu />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Prototype on Solana devnet. Test money only.</p>
          <a
            href="https://github.com/hepo306/Pfand"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-ink"
          >
            <GithubLogo size={16} /> Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
