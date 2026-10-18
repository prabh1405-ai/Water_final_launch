import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeliveryForm } from "@/components/DeliveryForm";
import { PaymentForm } from "@/components/PaymentForm";
import { DatePicker } from "@/components/DatePicker";
import { ExportExcel } from "@/components/ExportExcel";
import { PageNav } from "@/components/PageNav";
import {
  RATES,
  cansWith,
  customerTxns,
  deleteTxn,
  currentTime,
  pendingFor,
  rupees,
  shortDate,
  timestampForEntry,
  transactionEntries,
  transactionEntryKinds,
  updateTxn,
  useData,
  useHydratedToday,
  type Txn,
} from "@/lib/store";

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mondayOfWeek(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return shiftDate(iso, -((date.getDay() + 6) % 7));
}

function formatWeekRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const startLabel = startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const endLabel = endDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export const Route = createFileRoute("/customers/$id")({
  head: () => ({
    meta: [
      { title: "Customer ledger — Water Can Accounts" },
      { name: "description", content: "Full delivery and payment history for one company." },
      { property: "og:title", content: "Customer ledger — Water Can Accounts" },
      { property: "og:description", content: "Full delivery and payment history for one company." },
    ],
  }),
  component: CustomerLedger,
});

function EditTxnDialog({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const data = useData();
  const currentCans = cansWith(data, txn.customerId);
  const [date, setDate] = useState(txn.date);
  const [cans, setCans] = useState(String(txn.cans ?? 0));
  const [returned, setReturned] = useState(String(txn.cansReturned ?? 0));
  const [currentStock, setCurrentStock] = useState(
    txn.currentStock !== undefined ? String(txn.currentStock) : "",
  );
  const [rate, setRate] = useState(String(txn.rate ?? 30));
  const [amount, setAmount] = useState(String(txn.amount));
  const [amountLocked, setAmountLocked] = useState(
    txn.type === "delivery" ? txn.amount !== (txn.cans ?? 0) * (txn.rate ?? 0) : false,
  );

  async function save() {
    const createdAt = date === txn.date ? txn.createdAt : timestampForEntry(date, currentTime());
    if (createdAt === null) {
      toast.error("Enter a valid date");
      return;
    }
    if (txn.type === "delivery") {
      const n = Math.max(0, Math.floor(Number(cans || 0)));
      const r = Number(rate);
      const ret = Math.max(0, Math.floor(Number(returned || 0)));
      const a = Math.max(0, Math.floor(Number(amount || 0)));
      const originalReturned = txn.cansReturned ?? 0;
      const originalCans = txn.cans ?? 0;
      const netChange = n - originalCans - (ret - originalReturned);
      if (ret > 0 && currentCans + netChange < 0) {
        toast.error(`Cannot set returns to ${ret} — customer would have negative cans`);
        return;
      }
      if (n === 0 && ret === 0 && a <= 0) {
        toast.error("Enter cans, returns, or an amount");
        return;
      }
      const patch: Partial<{
        date: string;
        createdAt: number;
        cans: number;
        rate: number;
        amount: number;
        cansReturned: number;
        currentStock: number;
      }> = {
        date,
        createdAt,
        cans: n,
        rate: r,
        amount: a,
        cansReturned: ret,
      };
      if (currentStock) {
        patch.currentStock = Math.max(0, Math.floor(Number(currentStock || 0)));
      }
      try {
        await updateTxn(txn.id, patch);
      } catch (error) {
        toast.error(error instanceof Error ? `Could not update transaction: ${error.message}` : "Could not update transaction");
        return;
      }
    } else {
      const a = Math.max(1, Math.floor(Number(amount || 0)));
      try {
        await updateTxn(txn.id, { date, createdAt, amount: a });
      } catch (error) {
        toast.error(error instanceof Error ? `Could not update transaction: ${error.message}` : "Could not update transaction");
        return;
      }
    }
    toast.success("Transaction updated");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {txn.type === "delivery" ? "delivery" : "payment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-date">Date</Label>
            <Input
              id="e-date"
              type="date"
              className="h-11"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {txn.type === "delivery" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="e-cans">Number of cans</Label>
                  <Input
                    id="e-cans"
                    inputMode="numeric"
                    className="h-11"
                    value={cans}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const newCans = raw.replace(/^0+/, "") || (raw === "0" ? "0" : "");
                      setCans(newCans);
                      setAmount(String(Number(newCans || 0) * Number(rate)));
                      setAmountLocked(false);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate per can</Label>
                  <Select
                    value={rate}
                    onValueChange={(v) => {
                      setRate(v);
                      setAmount(String(Number(cans || 0) * Number(v)));
                      setAmountLocked(false);
                    }}
                  >
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-ret">Empty cans returned</Label>
                <Input
                  id="e-ret"
                  inputMode="numeric"
                  className="h-11"
                  value={returned}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setReturned(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-stock">Current stock (optional)</Label>
                <Input
                  id="e-stock"
                  inputMode="numeric"
                  className="h-11"
                  placeholder="Cans on hand"
                  value={currentStock}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setCurrentStock(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="e-amount-delivery">Delivery amount</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(String(Number(cans || 0) * Number(rate)));
                      setAmountLocked(false);
                    }}
                    className={`text-xs font-medium hover:underline ${
                      amountLocked ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {amountLocked ? "↺ Reset to cans × rate" : "Auto (cans × rate)"}
                  </button>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="e-amount-delivery"
                    inputMode="numeric"
                    className="h-11 pl-8"
                    value={amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      const next = raw.replace(/^0+/, "") || (raw === "0" ? "0" : "");
                      setAmount(next);
                      setAmountLocked(Number(next) !== Number(cans || 0) * Number(rate));
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="e-amt">Payment amount</Label>
              <Input
                id="e-amt"
                inputMode="numeric"
                className="h-11"
                value={amount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setAmount(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                }}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={save}>
              Save changes
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={async () => {
                try {
                  await deleteTxn(txn.id);
                } catch (error) {
                  toast.error(error instanceof Error ? `Could not delete transaction: ${error.message}` : "Could not delete transaction");
                  return;
                }
                toast.success("Transaction deleted");
                onClose();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerLedger() {
  const { id } = Route.useParams();
  const data = useData();
  const [mode, setMode] = useState<"delivery" | "payment" | null>(null);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");
  const hydratedToday = useHydratedToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const [quickRange, setQuickRange] = useState<"week" | "day" | null>(null);
  const [quickDay, setQuickDay] = useState<number | null>(null);

  const customer = data.customers.find((c) => c.id === id);
  const currentWeekStart = hydratedToday ? mondayOfWeek(hydratedToday) : "";
  const visibleWeekStart = currentWeekStart ? shiftDate(currentWeekStart, weekOffset * 7) : "";
  const weekDates = visibleWeekStart
    ? Array.from({ length: 7 }, (_, index) => shiftDate(visibleWeekStart, index))
    : [];

  function applyWeekFilter(start: string, selection: "week" | "day", dayIndex: number | null) {
    const end = shiftDate(start, 6);
    setQuickRange(selection);
    setQuickDay(dayIndex);
    setTransactionFrom(selection === "day" && dayIndex !== null ? shiftDate(start, dayIndex) : start);
    setTransactionTo(selection === "day" && dayIndex !== null ? shiftDate(start, dayIndex) : end);
  }

  function changeWeek(offset: number) {
    const nextOffset = weekOffset + offset;
    const nextStart = shiftDate(currentWeekStart, nextOffset * 7);
    setWeekOffset(nextOffset);
    if (quickRange === "week") {
      applyWeekFilter(nextStart, "week", null);
    } else if (quickRange === "day" && quickDay !== null) {
      applyWeekFilter(nextStart, "day", quickDay);
    } else {
      applyWeekFilter(nextStart, "week", null);
    }
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
        Customer not found.{" "}
        <Link to="/customers" className="text-primary hover:underline">
          Back to customers
        </Link>
      </div>
    );
  }

  const txns = customerTxns(data, customer.id);

  // Calculate opening balance as of transactionFrom
  let startingBalance = customer.openingPending;
  if (transactionFrom) {
    for (const t of txns) {
      if (t.date < transactionFrom) {
        startingBalance = t.type === "delivery" ? startingBalance + t.amount : startingBalance - t.amount;
      }
    }
  }

  const periodTxns = txns.filter(
    (t) =>
      (!transactionFrom || t.date >= transactionFrom) &&
      (!transactionTo || t.date <= transactionTo),
  );
  const deliveredRows = periodTxns.filter((txn) => txn.type === "delivery").reverse();
  const entryKinds = transactionEntryKinds(txns);

  let running = startingBalance;
  const ledgerRows = transactionEntries(periodTxns)
    .map((entry) => {
      running += (entry.delivery?.amount ?? 0) - (entry.payment?.amount ?? 0);
      return { entry, balance: running };
    });

  const totals = periodTxns.reduce(
    (acc, t) => {
      if (t.type === "delivery") {
        acc.cansDelivered += t.cans ?? 0;
        acc.cansReturned += t.cansReturned ?? 0;
        acc.deliveryAmount += t.amount;
      } else {
        acc.paymentAmount += t.amount;
      }
      return acc;
    },
    { cansDelivered: 0, cansReturned: 0, deliveryAmount: 0, paymentAmount: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/customers" className="text-sm text-muted-foreground hover:text-foreground">
        ← Customers
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{customer.name}</h1>

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Current pending</p>
        <p className="text-3xl font-semibold tabular-nums">
          {rupees(pendingFor(data, customer))}
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Contact person</dt>
            <dd>{customer.contact || "—"}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Phone</dt>
            <dd>
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} className="hover:underline text-primary">
                  {customer.phone}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Default rate</dt>
            <dd>₹{customer.defaultRate} per can</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Opening pending</dt>
            <dd>{rupees(customer.openingPending)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Opening cans on record</dt>
            <dd>{customer.openingCans ?? 0}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-muted-foreground">Cans with customer (current)</dt>
            <dd>{cansWith(data, customer.id)}</dd>
          </div>
          {customer.notes && (
            <div className="flex justify-between sm:block sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{customer.notes}</dd>
            </div>
          )}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="h-11" onClick={() => setMode("delivery")}>
            + Add Delivery
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setMode("payment")}>
            + Add Payment
          </Button>
          <ExportExcel defaultCompanyId={customer.id} hideCompanySelect />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Delivered History</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Date-wise record of delivered cans, empty returns, and delivery charges.
          </p>
        </div>
        {visibleWeekStart && (
          <div className="w-full rounded-lg border border-border bg-card p-3 sm:w-auto sm:min-w-[420px] sm:max-w-[560px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-primary" />
                <span>Daily activity</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Previous week"
                  onClick={() => changeWeek(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-8 px-2 text-xs tabular-nums ${
                    quickRange === "week" ? "bg-primary/10 text-primary" : ""
                  }`}
                  aria-label={`Show week ${formatWeekRange(visibleWeekStart, shiftDate(visibleWeekStart, 6))}`}
                  onClick={() => applyWeekFilter(visibleWeekStart, "week", null)}
                >
                  {formatWeekRange(visibleWeekStart, shiftDate(visibleWeekStart, 6))}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Next week"
                  onClick={() => changeWeek(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {weekDates.map((date, index) => {
                const selected = quickRange === "day" && quickDay === index;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Show ${new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}`}
                    onClick={() => applyWeekFilter(visibleWeekStart, "day", index)}
                    className={`rounded-lg border px-1 py-2 text-center transition-colors ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 hover:bg-muted"
                    }`}
                  >
                    <span className="block text-[10px] text-muted-foreground">
                      {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                        weekday: "short",
                      })}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold tabular-nums">
                      {new Date(`${date}T00:00:00`).getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="ledger-from" className="text-xs">
            From date
          </Label>
          <DatePicker
            id="ledger-from"
            value={transactionFrom}
            onChange={(value) => {
              setTransactionFrom(value);
              setQuickRange(null);
              setQuickDay(null);
            }}
            placeholder="From date"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ledger-to" className="text-xs">
            To date
          </Label>
          <DatePicker
            id="ledger-to"
            value={transactionTo}
            onChange={(value) => {
              setTransactionTo(value);
              setQuickRange(null);
              setQuickDay(null);
            }}
            placeholder="To date"
          />
        </div>
        {(transactionFrom || transactionTo) && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setTransactionFrom("");
              setTransactionTo("");
              setQuickRange(null);
              setQuickDay(null);
            }}
          >
            Clear date filter
          </Button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 text-right font-medium">Cans delivered</th>
              <th className="px-4 py-3 text-right font-medium">Cans returned</th>
              <th className="px-4 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">Delivery charge</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {deliveredRows.map((txn) => {
              const isReturnOnly = (txn.cans ?? 0) === 0 && (txn.cansReturned ?? 0) > 0;
              const kind = entryKinds.get(txn.id);
              const rowToneCls = isReturnOnly
                ? "bg-red-500/5"
                : kind === "mixed"
                  ? "bg-yellow-500/5"
                  : "bg-red-500/5";
              return (
                <tr
                  key={txn.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${rowToneCls}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{shortDate(txn.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(`${txn.date}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{txn.cans ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{txn.cansReturned ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {txn.rate ? `₹${txn.rate}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(txn.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(txn)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {deliveredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No deliveries recorded in this date range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Transaction History</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Complete date-wise ledger of deliveries, payments, and running pending balance.
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 font-medium">Entry type</th>
              <th className="px-4 py-3 text-right font-medium">Cans delivered</th>
              <th className="px-4 py-3 text-right font-medium">Cans returned</th>
              <th className="px-4 py-3 text-right font-medium">Current stock</th>
              <th className="px-4 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">Delivery charge</th>
              <th className="px-4 py-3 text-right font-medium" title="Payment received for this entry">Payment received</th>
              <th className="px-4 py-3 text-right font-medium">Pending balance</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map(({ entry, balance }) => {
              const delivery = entry.delivery;
              const payment = entry.payment;
              const isReturnOnly =
                delivery && (delivery.cans ?? 0) === 0 && (delivery.cansReturned ?? 0) > 0;
              const rowToneCls =
                entry.kind === "mixed"
                  ? "bg-yellow-500/5"
                  : entry.kind === "payment"
                    ? "bg-emerald-500/5"
                    : "bg-red-500/5";
              const typeLabel = isReturnOnly
                ? "Empty return"
                : entry.kind === "mixed"
                  ? "Delivery + Pay"
                  : entry.kind === "payment"
                    ? "Payment"
                    : "Delivery";
              const typePillCls =
                entry.kind === "mixed"
                  ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                  : entry.kind === "payment"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400";
              return (
                <tr
                  key={entry.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${rowToneCls}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{shortDate(entry.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${typePillCls}`}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {delivery && delivery.cans && delivery.cans > 0 ? (
                      <span className="font-medium text-foreground">{delivery.cans}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {delivery && delivery.cansReturned && delivery.cansReturned > 0 ? (
                      <span className="text-foreground">{delivery.cansReturned}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {delivery?.currentStock !== undefined ? (
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {delivery.currentStock}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {delivery?.rate ? `₹${delivery.rate}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {delivery && delivery.amount > 0 ? (
                      rupees(delivery.amount)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {payment ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {rupees(payment.amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    <span
                      className={
                        balance > 0
                          ? "text-foreground font-semibold"
                          : balance < 0
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {balance < 0 ? `Adv ${rupees(Math.abs(balance))}` : rupees(balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {delivery && (
                        <button
                          type="button"
                          onClick={() => setEditing(delivery)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {payment ? "Edit delivery" : "Edit"}
                        </button>
                      )}
                      {payment && (
                        <button
                          type="button"
                          onClick={() => setEditing(payment)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {delivery ? "Edit payment" : "Edit"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {ledgerRows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                  No entries or payments recorded yet
                </td>
              </tr>
            )}
          </tbody>
          {ledgerRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td colSpan={3} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.cansDelivered}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.cansReturned}</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right tabular-nums">{rupees(totals.deliveryAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {rupees(totals.paymentAmount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {(ledgerRows[ledgerRows.length - 1]?.balance ?? 0) < 0
                    ? `Adv ${rupees(Math.abs(ledgerRows[ledgerRows.length - 1]?.balance ?? 0))}`
                    : rupees(ledgerRows[ledgerRows.length - 1]?.balance ?? 0)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <PageNav current="/customers/$id" />

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "delivery" ? "Add delivery" : "Add payment"} — {customer.name}
            </DialogTitle>
          </DialogHeader>
          {mode === "delivery" ? (
            <DeliveryForm lockedCustomerId={customer.id} onSaved={() => setMode(null)} />
          ) : mode === "payment" ? (
            <PaymentForm lockedCustomerId={customer.id} onSaved={() => setMode(null)} />
          ) : null}
        </DialogContent>
      </Dialog>

      {editing && <EditTxnDialog txn={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
