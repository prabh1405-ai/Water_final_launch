import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { to: "/", label: "Daily Entry" },
  { to: "/customers", label: "Customers" },
  { to: "/payments", label: "Payments" },
  { to: "/expenses", label: "Expenses" },
  { to: "/history", label: "History" },
] as const;

export function AppNav() {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) toast.error(`Could not sign out: ${error.message}`);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not sign out: ${error.message}` : "Could not sign out");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-base font-semibold tracking-tight">
            Water Can Accounts
          </Link>
          {supabase && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="md:hidden"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>

        <nav className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              {links.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link
                    to={l.to}
                    activeOptions={{ exact: l.to === "/" }}
                    activeProps={{ className: "font-medium bg-accent" }}
                  >
                    {l.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <nav className="-mx-1 hidden items-center gap-1 overflow-x-auto md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {supabase && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={signingOut}
            onClick={() => void signOut()}
            className="hidden md:inline-flex"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        )}
      </div>
    </header>
  );
}
