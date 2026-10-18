import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanySelect } from "@/components/CompanySelect";
import {
  addTxn,
  cansWith,
  currentTime,
  pendingFor,
  rupees,
  timestampForEntry,
  useData,
  useHydratedToday,
} from "@/lib/store";

export function PaymentForm({
  lockedCustomerId,
  onSaved,
}: {
  lockedCustomerId?: string;
  onSaved?: () => void;
}) {
  const data = useData();
  const hydratedToday = useHydratedToday();
  const [date, setDate] = useState<string>("");
  const [customerId, setCustomerId] = useState<string | null>(lockedCustomerId ?? null);
  const [amountText, setAmountText] = useState("");

  useEffect(() => {
    if (hydratedToday) {
      setDate((prev) => prev || hydratedToday);
    }
  }, [hydratedToday]);

  const customer = data.customers.find((c) => c.id === customerId) ?? null;
  const previous = customer ? pendingFor(data, customer) : 0;
  const currentCans = customer ? cansWith(data, customer.id) : 0;
  const amount = Math.max(0, Math.floor(Number(amountText || 0)));

  async function save() {
    if (!customerId) {
      toast.error("Select a company first");
      return;
    }
    if (amount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    const createdAt = timestampForEntry(date, currentTime());
    if (createdAt === null) {
      toast.error("Enter a valid date");
      return;
    }
    try {
      await addTxn({ customerId, date, type: "payment", amount }, createdAt);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not save payment: ${error.message}` : "Could not save payment");
      return;
    }
    toast.success(`Payment ${rupees(amount)} recorded`);
    setAmountText("");
    if (!lockedCustomerId) setCustomerId(null);
    onSaved?.();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-date">Date</Label>
          <Input
            id="p-date"
            type="date"
            className="h-11"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!lockedCustomerId && (
          <div className="space-y-2">
            <Label>Company</Label>
            <CompanySelect customers={data.customers} value={customerId} onChange={setCustomerId} />
          </div>
        )}
      </div>

      {customer && (
        <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-sm">
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
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <div className="rounded bg-background px-2.5 py-1 border border-border">
                <span className="text-muted-foreground">Current pending: </span>
                <span className={`font-semibold ${previous > 0 ? "text-amber-600 dark:text-amber-400" : previous < 0 ? "text-emerald-600" : "text-foreground"}`}>
                  {previous > 0 ? rupees(previous) : previous < 0 ? `Advance ${rupees(Math.abs(previous))}` : "₹0"}
                </span>
              </div>
              <div className="rounded bg-background px-2.5 py-1 border border-border">
                <span className="text-muted-foreground">Cans with company: </span>
                <span className="font-semibold">{currentCans}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="p-amt">Payment amount</Label>
          {customer && previous > 0 && (
            <button
              type="button"
              onClick={() => setAmountText(String(previous))}
              className="text-xs font-medium text-primary hover:underline"
            >
              Settle full pending ({rupees(previous)})
            </button>
          )}
        </div>
        <Input
          id="p-amt"
          inputMode="numeric"
          className="h-11"
          placeholder="0"
          value={amountText}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            setAmountText(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
          }}
        />
      </div>

      {customer && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3.5 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Previous pending balance</span>
            <span className="font-medium text-foreground">{rupees(previous)}</span>
          </div>
          <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
            <span>Payment to record</span>
            <span className="font-medium">−{rupees(amount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>New pending balance</span>
            <span className={previous - amount > 0 ? "text-amber-600 dark:text-amber-400" : previous - amount < 0 ? "text-emerald-600" : "text-foreground"}>
              {previous - amount > 0
                ? rupees(previous - amount)
                : previous - amount < 0
                ? `Advance ${rupees(Math.abs(previous - amount))}`
                : "Settled (₹0)"}
            </span>
          </div>
        </div>
      )}

      <Button className="h-12 w-full text-base" onClick={save}>
        Save payment
      </Button>
    </div>
  );
}
