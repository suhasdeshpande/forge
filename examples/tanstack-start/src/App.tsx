import type { ReactNode } from "react";
import "./App.css";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Forge + TanStack Start</p>
          <h1>Stream pipeline events on the client</h1>
          <p className="lede">
            A small TanStack Router app that consumes the Forge Hono SSE example
            and renders typed pipeline activity as it arrives.
          </p>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
