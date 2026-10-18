import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanySelect } from "@/components/CompanySelect";
import { ExportExcel } from "@/components/ExportExcel";
import { QtyStepper } from "@/components/QtyStepper";
import {
  RATES,
  addTxns,
  cansWith,
  currentTime,
  pendingFor,
  rupees,
  sameTransactionEntry,
  shortDate,
  shortTime,
  timestampForEntry,
  transactionEntryKinds,
  useData,
  useHydratedToday,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export function DeliveryForm({
  lockedCustomerId,
  onSaved,
}: {
  lockedCustomerId?: string;
  onSaved?: () => void;
}) {
  const data = useData();
  const { customers } = data;
  const hydratedToday = useHydratedToday();
  const [date, setDate] = useState<string>("");
  const [customerId, setCustomerId] = useState<string | null>(lockedCustomerId ?? null);
  const [cansIn, setCansIn] = useState(0);
  const [cansOut, setCansOut] = useState(0);
  const [rate, setRate] = useState(30);
  const [payNow, setPayNow] = useState("");

  useEffect(() => {
    if (hydratedToday) {
      setDate((prev) => prev || hydratedToday);
    }
  }, [hydratedToday]);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const currentPending = customer ? pendingFor(data, customer) : 0;
  const currentCans = customer ? cansWith(data, customer.id) : 0;

  useEffect(() => {
    if (customer) setRate(customer.defaultRate);
  }, [customer?.id, customer?.defaultRate]);

  const amount = cansIn * rate;
  const payment = Math.max(0, Math.floor(Number(payNow || 0)));

  async function save() {
    if (!customerId) {
      toast.error("Select a company first");
      return;
    }
    const createdAt = timestampForEntry(date, currentTime());
    if (createdAt === null) {
      toast.error("Enter a valid date");
      return;
    }
    if (cansIn < 1 && payment <= 0 && cansOut <= 0) {
      toast.error("Enter number of cans or payment amount");
      return;
    }
    if (cansOut > 0 && cansOut > currentCans + cansIn) {
      toast.error(
        `Cannot take ${cansOut} cans out — customer would only have ${currentCans + cansIn} after this entry`,
      );
      return;
    }
    const transactions: Parameters<typeof addTxns>[0] = [];
    if (cansIn > 0 || cansOut > 0) {
      transactions.push({
        customerId,
        date,
        type: "delivery",
        cans: cansIn,
        ...(cansOut > 0 ? { cansReturned: cansOut } : {}),
        rate,
        amount,
      });
    }
    if (payment > 0) {
      transactions.push({ customerId, date, type: "payment", amount: payment });
    }
    try {
      await addTxns(transactions, createdAt);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not save entry: ${error.message}` : "Could not save entry");
      return;
    }

    const messages: string[] = [];
    if (cansIn > 0) messages.push(`${cansIn} in (${rupees(amount)})`);
    if (cansOut > 0) messages.push(`${cansOut} out`);
    if (payment > 0) messages.push(`payment ${rupees(payment)}`);
    toast.success(`Saved: ${messages.join(" + ")}`);

    setCansIn(0);
    setCansOut(0);
    setPayNow("");
    if (!lockedCustomerId) setCustomerId(null);
    onSaved?.();
  }

  const todayTxnsRaw = data.txns
    .filter((t) => t.date === date)
    .sort((a, b) => b.createdAt - a.createdAt);
  const entryKinds = transactionEntryKinds(data.txns);

  type MergedRow = {
    key: string;
    sortAt: number;
    customerId: string;
    kind: "delivery" | "payment" | "mixed";
    delivery?: (typeof todayTxnsRaw)[number];
    payment?: (typeof todayTxnsRaw)[number];
  };
  const pairedIds = new Set<string>();
  const mergedRows: MergedRow[] = [];
  for (const t of todayTxnsRaw) {
    if (pairedIds.has(t.id)) continue;
    if (t.type === "delivery") {
      const pair = todayTxnsRaw.find(
        (p) =>
          p.type === "payment" &&
          !pairedIds.has(p.id) &&
          entryKinds.get(p.id) === "mixed" &&
          sameTransactionEntry(p, t),
      );
      if (pair) {
        pairedIds.add(t.id);
        pairedIds.add(pair.id);
        mergedRows.push({
          key: `${t.id}|${pair.id}`,
          sortAt: Math.max(t.createdAt, pair.createdAt),
          customerId: t.customerId,
          kind: entryKinds.get(t.id) ?? "mixed",
          delivery: t,
          payment: pair,
        });
      } else {
        pairedIds.add(t.id);
        mergedRows.push({
          key: t.id,
          sortAt: t.createdAt,
          customerId: t.customerId,
          kind: entryKinds.get(t.id) ?? "delivery",
          delivery: t,
        });
      }
    } else {
      const pair = todayTxnsRaw.find(
        (p) =>
          p.type === "delivery" &&
          !pairedIds.has(p.id) &&
          entryKinds.get(p.id) === "mixed" &&
          sameTransactionEntry(p, t),
      );
      if (!pair) {
        pairedIds.add(t.id);
        mergedRows.push({
          key: t.id,
          sortAt: t.createdAt,
          customerId: t.customerId,
          kind: entryKinds.get(t.id) ?? "payment",
          payment: t,
        });
      }
    }
  }
  mergedRows.sort((a, b) => a.sortAt - b.sortAt);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="d-date">Date</Label>
          <Input
            id="d-date"
            type="date"
            className="h-11"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!lockedCustomerId && (
          <div className="space-y-2">
            <Label>Company</Label>
            <CompanySelect customers={customers} value={customerId} onChange={setCustomerId} />
          </div>
        )}
      </div>

      {customer && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">{customer.name}</div>
              {(customer.contact || customer.phone) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {customer.contact && <span>Contact: {customer.contact}</span>}
                  {customer.contact && customer.phone && <span> • </span>}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="hover:underline text-primary">
                      {customer.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <div className="rounded bg-background px-2.5 py-1 border border-border">
                <span className="text-muted-foreground">Pending: </span>
                <span className={`font-semibold ${currentPending > 0 ? "text-amber-600 dark:text-amber-400" : currentPending < 0 ? "text-emerald-600" : "text-foreground"}`}>
                  {currentPending > 0 ? rupees(currentPending) : currentPending < 0 ? `Advance ${rupees(Math.abs(currentPending))}` : "₹0"}
                </span>
              </div>
              <div className="rounded bg-background px-2.5 py-1 border border-border">
                <span className="text-muted-foreground">Cans with company: </span>
                <span className="font-semibold">{currentCans}</span>
              </div>
              <Link
                to="/customers/$id"
                params={{ id: customer.id }}
                className="text-xs text-primary underline-offset-4 hover:underline font-medium ml-1"
              >
                View →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Number of cans (in)</Label>
            <div className="flex items-center gap-1">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={`in-${n}`}
                  type="button"
                  onClick={() => setCansIn(n)}
                  className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                    cansIn === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <QtyStepper value={cansIn} onChange={setCansIn} min={0} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Number of cans (out)</Label>
            <div className="flex items-center gap-1">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={`out-${n}`}
                  type="button"
                  onClick={() => setCansOut(n)}
                  className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                    cansOut === n
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-border bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <QtyStepper value={cansOut} onChange={setCansOut} min={0} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Rate per can</Label>
          <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATES.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  ₹{r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="d-pay">Payment received now (optional)</Label>
            <div className="flex items-center gap-2">
              {amount > 0 && (
                <button
                  type="button"
                  onClick={() => setPayNow(String(amount))}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                >
                  Today ({rupees(amount)})
                </button>
              )}
              {customer && currentPending > 0 && amount > 0 && (
                <button
                  type="button"
                  onClick={() => setPayNow(String(currentPending + amount))}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                >
                  Clear all ({rupees(currentPending + amount)})
                </button>
              )}
              {customer && currentPending > 0 && amount === 0 && (
                <button
                  type="button"
                  onClick={() => setPayNow(String(currentPending))}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                >
                  Clear pending ({rupees(currentPending)})
                </button>
              )}
            </div>
          </div>
          <Input
            id="d-pay"
            inputMode="numeric"
            className="h-11"
            placeholder="0"
            value={payNow}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setPayNow(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
            }}
          />
        </div>
      </div>

      {customer ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Previous pending balance</span>
            <span className="font-medium text-foreground">{rupees(currentPending)}</span>
          </div>
          {amount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Today's delivery ({cansIn} in × ₹{rate})</span>
              <span className="font-medium text-foreground">+{rupees(amount)}</span>
            </div>
          )}
          {cansOut > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cans returned ({cansOut} out)</span>
              <span className="font-medium text-sky-600 dark:text-sky-400">−{cansOut} empties</span>
            </div>
          )}
          {amount > 0 && payment > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground border-t border-dashed border-border pt-1.5">
              <span>Total with today's delivery</span>
              <span className="font-semibold text-foreground">{rupees(currentPending + amount)}</span>
            </div>
          )}
          {payment > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <span>Payment received now</span>
              <span className="font-semibold">−{rupees(payment)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Estimated new total pending</span>
            <span
              className={
                currentPending + amount - payment > 0
                  ? "text-amber-600 dark:text-amber-400 font-bold"
                  : currentPending + amount - payment < 0
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-foreground font-bold"
              }
            >
              {currentPending + amount - payment < 0
                ? `Advance ${rupees(Math.abs(currentPending + amount - payment))}`
                : currentPending + amount - payment === 0
                ? "Settled (₹0)"
                : rupees(currentPending + amount - payment)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Delivery amount ({cansIn} in × ₹{rate})
            </span>
            <span className="text-lg font-semibold">{rupees(amount)}</span>
          </div>
        </div>
      )}

      {!lockedCustomerId && (
        <div className="pt-2">
          <ExportExcel defaultCompanyId={customerId} followCompanyId={customerId} />
        </div>
      )}

      <Button className="h-12 w-full text-base" onClick={save}>
        Save entry
      </Button>

      {!lockedCustomerId && (
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {!date
                ? "Entries"
                : date === hydratedToday
                ? `Today's Saved Entries (${shortDate(date)})`
                : `Entries for ${shortDate(date)}`}
            </h3>
            <span className="text-xs text-muted-foreground">{mergedRows.length} entries</span>
          </div>
          {mergedRows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Cans (in / out)</th>
                    <th className="px-3 py-2 text-right font-medium">Today Charge</th>
                    <th className="px-3 py-2 text-right font-medium">Amount Received</th>
                    <th className="px-3 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row) => {
                    const comp = customers.find((c) => c.id === row.customerId);
                    const tDel = row.delivery;
                    const tPay = row.payment;
                    const isReturnOnly =
                      !!tDel &&
                      (tDel.cans ?? 0) === 0 &&
                      (tDel.cansReturned ?? 0) > 0;
                    const hasReturns =
                      !!tDel && (tDel.cansReturned ?? 0) > 0;
                    const hasCans = !!tDel && (tDel.cans ?? 0) > 0;
                    const typePillCls =
                      row.kind === "payment"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : row.kind === "mixed"
                          ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                          : "bg-red-500/10 text-red-700 dark:text-red-400";
                    const rowToneCls =
                      row.kind === "payment"
                        ? "bg-emerald-500/5"
                        : row.kind === "mixed"
                        ? "bg-yellow-500/5"
                        : "bg-red-500/5";
                    const typeLabel =
                      row.kind === "payment"
                        ? "Payment"
                        : isReturnOnly
                        ? "Empty return"
                        : row.kind === "mixed"
                        ? "Delivery + Pay"
                        : "Delivery";
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-border last:border-0 ${rowToneCls}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link
                            to="/customers/$id"
                            params={{ id: row.customerId }}
                            className="hover:underline text-primary"
                          >
                            {comp?.name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {shortTime(row.sortAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                              typePillCls,
                            )}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {row.kind === "payment" || !tDel ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="space-x-1">
                              {hasCans && (
                                <span className="font-semibold text-foreground">
                                  {tDel.cans} in
                                </span>
                              )}
                              {hasCans && hasReturns && (
                                <span className="text-muted-foreground">/</span>
                              )}
                              {hasReturns && (
                                <span className="text-sky-600 dark:text-sky-400 font-medium">
                                  {tDel.cansReturned} out
                                </span>
                              )}
                              {!hasCans && !hasReturns && (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap align-middle">
                          {tDel && !isReturnOnly && (tDel.amount ?? 0) > 0 ? (
                            <span className="text-red-600 dark:text-red-400">
                              {rupees(tDel.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap align-middle">
                          {tPay && tPay.amount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {rupees(tPay.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            to="/customers/$id"
                            params={{ id: row.customerId }}
                            className="text-primary hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <div className="text-sm font-medium text-foreground">No entries yet</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Select a company above, enter the delivery details, and click <span className="font-medium text-foreground">Save entry</span>. Entries will appear here.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
