import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentForm } from "@/components/PaymentForm";
import { PageNav } from "@/components/PageNav";
import {
  daysSince,
  lastPaymentDate,
  pendingFor,
  rupees,
  shortDate,
  useData,
  useHydratedToday,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Water Can Accounts" },
      { name: "description", content: "Track pending balances, payment aging, and record payments." },
      { property: "og:title", content: "Payments — Water Can Accounts" },
      { property: "og:description", content: "Track pending balances, payment aging, and record payments." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const data = useData();
  const hydratedToday = useHydratedToday();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "settled">("pending");
  const [sort, setSort] = useState<"highest" | "oldest">("highest");

  const rows = useMemo(() => {
    const list = data.customers.map((customer) => {
      const pending = pendingFor(data, customer);
      const last = lastPaymentDate(data, customer.id);
      const days = last ? daysSince(last, hydratedToday) : null;
      return { customer, pending, last, days };
    });

    const filtered = list.filter((r) => {
      if (filter === "pending") return r.pending > 0;
      return r.pending <= 0;
    });

    filtered.sort((a, b) => {
      if (sort === "highest") {
        return b.pending - a.pending || a.customer.name.localeCompare(b.customer.name);
      }
      return (b.days ?? 99999) - (a.days ?? 99999) || b.pending - a.pending;
    });

    return filtered;
  }, [data, filter, sort, hydratedToday]);

  const totalOwed = data.customers.reduce((sum, c) => {
    const p = pendingFor(data, c);
    return sum + (p > 0 ? p : 0);
  }, 0);

  const totalAdvance = data.customers.reduce((sum, c) => {
    const p = pendingFor(data, c);
    return sum + (p < 0 ? Math.abs(p) : 0);
  }, 0);

  const pendingCount = data.customers.filter((c) => pendingFor(data, c) > 0).length;
  const selected = data.customers.find((customer) => customer.id === customerId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track what each company owes, payment aging, and record new settlements.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-right">
            <p className="text-xs text-muted-foreground">Total pending ({pendingCount} {pendingCount === 1 ? "due" : "dues"})</p>
            <p className="text-xl font-semibold tabular-nums">{rupees(totalOwed)}</p>
          </div>
          {totalAdvance > 0 && (
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-right">
              <p className="text-xs text-muted-foreground">Total advance credits</p>
              <p className="text-xl font-semibold tabular-nums text-emerald-600">{rupees(totalAdvance)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {/* Filter chips */}
        <div className="inline-flex rounded-md border border-border p-1">
          {(
            [
              ["pending", "Pending Only"],
              ["settled", "Settled / Advance"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort options */}
        <div className="inline-flex rounded-md border border-border p-1">
          {(
            [
              ["highest", "Highest Pending"],
              ["oldest", "Oldest Due Date"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                sort === key ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 text-right font-medium">Pending balance</th>
              <th className="px-4 py-3 font-medium">Last payment</th>
              <th className="px-4 py-3 text-right font-medium">Aging</th>
              <th className="px-4 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ customer, pending, last, days }) => (
              <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to="/customers/$id"
                    params={{ id: customer.id }}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {customer.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {pending > 0 ? (
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{rupees(pending)}</span>
                  ) : pending < 0 ? (
                    <span className="font-medium text-emerald-600">
                      Advance: {rupees(Math.abs(pending))}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Settled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {last ? (
                    shortDate(last)
                  ) : (
                    <span className="text-xs text-muted-foreground/70">No payment yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {days !== null ? <span>{days === 0 ? "Today" : `${days}d ago`}</span> : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setCustomerId(customer.id)}
                    >
                      Record payment
                    </Button>
                    <Link
                      to="/customers/$id"
                      params={{ id: customer.id }}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No matching companies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={customerId !== null} onOpenChange={(open) => !open && setCustomerId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record payment{selected ? ` — ${selected.name}` : ""}</DialogTitle>
          </DialogHeader>
          {selected && <PaymentForm lockedCustomerId={selected.id} onSaved={() => setCustomerId(null)} />}
        </DialogContent>
      </Dialog>

      <PageNav current="/payments" />
    </div>
  );
}
