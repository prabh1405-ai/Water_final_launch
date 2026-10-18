import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageNav } from "@/components/PageNav";
import {
  deleteExpense,
  rupees,
  upsertExpense,
  upsertWaterFilling,
  useData,
  useHydratedToday,
  type Expense,
  type WaterFillingRecord,
} from "@/lib/store";

const DIESEL_OPTIONS = [0, 200, 300, 350, 400, 450, 500, 550, 600, 700];
const FILLING_BATCH_COUNT = 4;

function createBatchInputs(batches: WaterFillingRecord["batches"] = []) {
  return Array.from({ length: FILLING_BATCH_COUNT }, (_, index) => ({
    cans: batches[index] && batches[index].cans > 0 ? String(batches[index].cans) : "",
    rate: batches[index] ? String(batches[index].rate) : "12",
  }));
}

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
  return `${startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Water Can Accounts" },
      { name: "description", content: "Record day-wise diesel, snacks, and food expenses." },
      { property: "og:title", content: "Expenses — Water Can Accounts" },
      { property: "og:description", content: "Record day-wise diesel, snacks, and food expenses." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const data = useData();
  const hydratedToday = useHydratedToday();
  const [date, setDate] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectionMode, setSelectionMode] = useState<"day" | "week">("day");
  const [batchInputs, setBatchInputs] = useState(() => createBatchInputs());
  const [isEditingFilling, setIsEditingFilling] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    if (hydratedToday) setDate((prev) => prev || hydratedToday);
  }, [hydratedToday]);

  const currentWeekStart = hydratedToday ? mondayOfWeek(hydratedToday) : "";
  const visibleWeekStart = currentWeekStart ? shiftDate(currentWeekStart, weekOffset * 7) : "";
  const weekDates = visibleWeekStart
    ? Array.from({ length: 7 }, (_, index) => shiftDate(visibleWeekStart, index))
    : [];

  const selectedFilling = data.waterFilling.find((record) => record.date === date);
  useEffect(() => {
    setBatchInputs(createBatchInputs(selectedFilling?.batches));
  }, [date, selectedFilling]);
  const showFillingForm = !selectedFilling || isEditingFilling;
  const [diesel, setDiesel] = useState("");
  const [snacksFood, setSnacksFood] = useState("");
  const [serviceRepairs, setServiceRepairs] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");

  const selectedExpense = data.expenses.find((expense) => expense.date === date);
  useEffect(() => {
    setDiesel(selectedExpense?.diesel ? String(selectedExpense.diesel) : "");
    setSnacksFood(selectedExpense?.snacksFood ? String(selectedExpense.snacksFood) : "");
    setServiceRepairs(selectedExpense?.serviceRepairs ? String(selectedExpense.serviceRepairs) : "");
    setServiceNotes(selectedExpense?.serviceNotes ?? "");
  }, [
    date,
    selectedExpense?.id,
    selectedExpense?.diesel,
    selectedExpense?.snacksFood,
    selectedExpense?.serviceRepairs,
    selectedExpense?.serviceNotes,
  ]);

  const expenses = useMemo(
    () => [...data.expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [data.expenses],
  );
  const visibleExpenses = expenses.filter((expense) =>
    selectionMode === "day"
      ? expense.date === date
      : expense.date >= visibleWeekStart && expense.date <= shiftDate(visibleWeekStart, 6),
  );
  const visibleFillingRecords = data.waterFilling
    .filter((record) =>
      selectionMode === "day"
        ? record.date === date
        : record.date >= visibleWeekStart && record.date <= shiftDate(visibleWeekStart, 6),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = useMemo(() => {
    return visibleExpenses.reduce(
      (acc, exp) => ({
        diesel: acc.diesel + exp.diesel,
        snacksFood: acc.snacksFood + exp.snacksFood,
        serviceRepairs: acc.serviceRepairs + (exp.serviceRepairs || 0),
        grandTotal: acc.grandTotal + exp.diesel + exp.snacksFood + (exp.serviceRepairs || 0),
      }),
      { diesel: 0, snacksFood: 0, serviceRepairs: 0, grandTotal: 0 },
    );
  }, [visibleExpenses]);

  const batchBills = batchInputs.map(
    ({ cans, rate }) => Math.floor(Number(cans || 0)) * Math.floor(Number(rate || 0)),
  );
  const dailyFillingTotal = batchBills.reduce((sum, bill) => sum + bill, 0);
  const fillingByDate = new Map(data.waterFilling.map((record) => [record.date, record]));

  function updateBatch(index: number, field: "cans" | "rate", value: string) {
    const digits = value.replace(/\D/g, "");
    setBatchInputs((current) =>
      current.map((batch, batchIndex) =>
        batchIndex === index ? { ...batch, [field]: digits } : batch,
      ),
    );
  }

  async function saveWaterFilling() {
    if (!date) {
      toast.error("Choose a filling date");
      return;
    }
    const batches: WaterFillingRecord["batches"] = batchInputs.map(({ cans, rate }) => ({
      cans: Math.max(0, Math.floor(Number(cans || 0))),
      rate: Math.max(0, Math.floor(Number(rate || 0))),
    }));
    if (!batches.some((batch) => batch.cans > 0)) {
      toast.error("Enter cans filled in at least one batch");
      return;
    }
    try {
      await upsertWaterFilling(date, batches);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not save filling record: ${error.message}` : "Could not save filling record");
      return;
    }
    toast.success(`Water filling saved for ${date}`);
    setIsEditingFilling(false);
  }

  function editWaterFilling() {
    setBatchInputs(createBatchInputs(selectedFilling?.batches));
    setIsEditingFilling(true);
  }

  function cancelWaterFillingEdit() {
    setBatchInputs(createBatchInputs(selectedFilling?.batches));
    setIsEditingFilling(false);
  }

  async function confirmDeleteExpense() {
    if (!deleteCandidate) return;
    if (deleteConfirmation !== "yes") {
      toast.error('Type lowercase "yes" to confirm deletion');
      return;
    }
    const expense = data.expenses.find((item) => item.id === deleteCandidate);
    try {
      await deleteExpense(deleteCandidate);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not delete expense: ${error.message}` : "Could not delete expense");
      return;
    }
    if (expense && date === expense.date) {
      setDiesel("");
      setSnacksFood("");
      setServiceRepairs("");
      setServiceNotes("");
    }
    setDeleteCandidate(null);
    setDeleteConfirmation("");
    toast.success("Expense removed");
  }

  async function save() {
    const dieselAmt = Math.max(0, Math.floor(Number(diesel || 0)));
    const foodAmt = Math.max(0, Math.floor(Number(snacksFood || 0)));
    const repairsAmt = Math.max(0, Math.floor(Number(serviceRepairs || 0)));

    if (dieselAmt === 0 && foodAmt === 0 && repairsAmt === 0) {
      toast.error("Enter payment amount for at least one expense");
      return;
    }

    const exp: Omit<Expense, "id" | "createdAt"> = {
      date,
      diesel: dieselAmt,
      snacksFood: foodAmt,
      serviceRepairs: repairsAmt,
    };
    const trimmed = serviceNotes.trim();
    if (trimmed) exp["serviceNotes"] = trimmed;
    try {
      await upsertExpense(exp);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not save expenses: ${error.message}` : "Could not save expenses");
      return;
    }
    toast.success(`Expenses saved for ${date}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keep diesel, snacks, and food costs by day.</p>

      <div className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
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
              onClick={() => {
                setWeekOffset((offset) => offset - 1);
                setSelectionMode("week");
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant={selectionMode === "week" ? "secondary" : "ghost"}
              className="h-8 px-2 text-xs tabular-nums"
              aria-pressed={selectionMode === "week"}
              onClick={() => setSelectionMode("week")}
            >
              {visibleWeekStart
                ? formatWeekRange(visibleWeekStart, shiftDate(visibleWeekStart, 6))
                : "Loading dates"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next week"
              onClick={() => {
                setWeekOffset((offset) => offset + 1);
                setSelectionMode("week");
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekDates.map((weekDate) => {
            const active = selectionMode === "day" && weekDate === date;
            const record = fillingByDate.get(weekDate);
            const amount =
              record?.batches.reduce((sum, batch) => sum + batch.cans * batch.rate, 0) ?? 0;
            const parsedDate = new Date(`${weekDate}T00:00:00`);
            return (
              <button
                key={weekDate}
                type="button"
                aria-pressed={active}
                aria-label={`Select ${parsedDate.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
                onClick={() => {
                  setDate(weekDate);
                  setSelectionMode("day");
                  setIsEditingFilling(false);
                }}
                className={`rounded-lg border px-1 py-2 text-center transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 hover:bg-muted"
                }`}
              >
                <span className="block text-[10px] text-muted-foreground">
                  {parsedDate.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="mt-0.5 block text-sm font-semibold tabular-nums">
                  {parsedDate.getDate()}
                </span>
                {amount > 0 && (
                  <span className="mt-0.5 block truncate text-[9px] font-medium text-destructive">
                    {rupees(amount)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label htmlFor="activity-date" className="text-xs text-muted-foreground">
            Choose date
          </Label>
          <Input
            id="activity-date"
            type="date"
            className="h-9 w-[170px]"
            value={date}
            onChange={(event) => {
              const nextDate = event.target.value;
              if (!nextDate) return;
              setDate(nextDate);
              setSelectionMode("day");
              setIsEditingFilling(false);
              const dayOffset = Math.floor(
                (new Date(`${mondayOfWeek(nextDate)}T00:00:00`).getTime() -
                  new Date(`${currentWeekStart}T00:00:00`).getTime()) /
                  86400000,
              );
              setWeekOffset(dayOffset / 7);
            }}
          />
          <span className="text-xs text-muted-foreground">
            Select a day for that day’s records, or select the week range for weekly totals.
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
        {selectionMode === "day" && (
          <>
        <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="expense-diesel">Diesel (₹)</Label>
              <div className="flex items-center gap-1">
                {[300, 500, 800].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDiesel(String(amt))}
                    className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="expense-diesel"
                inputMode="numeric"
                className="h-11 pl-8"
                placeholder="0"
                value={diesel}
                onFocus={(e) => e.target.select()}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9]/g, "");
                  setDiesel(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="snacks-food">Snacks & food (₹)</Label>
              <div className="flex items-center gap-1">
                {[50, 100, 150].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSnacksFood(String(amt))}
                    className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="snacks-food"
                inputMode="numeric"
                className="h-11 pl-8"
                placeholder="0"
                value={snacksFood}
                onFocus={(e) => e.target.select()}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9]/g, "");
                  setSnacksFood(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="space-y-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="service-repairs">Service & repairs (₹)</Label>
              <div className="flex items-center gap-1">
                {[200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setServiceRepairs(String(amt))}
                    className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="service-repairs"
                inputMode="numeric"
                className="h-11 pl-8"
                placeholder="0"
                value={serviceRepairs}
                onFocus={(e) => e.target.select()}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9]/g, "");
                  setServiceRepairs(raw.replace(/^0+/, "") || (raw === "0" ? "0" : ""));
                }}
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service-notes" className="text-xs text-muted-foreground">
              Service / repair notes (optional)
            </Label>
            <Input
              id="service-notes"
              className="h-11 text-xs"
              placeholder="e.g. Oil change, tyre puncture, brake check..."
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Daily total:{" "}
            <span className="text-base font-bold text-foreground">
              {rupees(Number(diesel || 0) + Number(snacksFood || 0) + Number(serviceRepairs || 0))}
            </span>
          </p>
          <Button type="button" className="h-11 px-6" onClick={save}>
            Save expenses
          </Button>
        </div>
          </>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {selectionMode === "week" ? "Weekly expenses" : "Day-wise expenses"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectionMode === "week"
                ? formatWeekRange(visibleWeekStart, shiftDate(visibleWeekStart, 6))
                : new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
            </p>
          </div>
          {selectionMode === "week" && (
            <div className="text-right text-sm font-semibold tabular-nums">
              Selected expenses total: {rupees(totals.grandTotal)}
            </div>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Diesel</th>
                <th className="px-4 py-3 text-right font-medium">Snacks & food</th>
                <th className="px-4 py-3 text-right font-medium">Service & repairs</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map((expense) => (
                <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(`${expense.date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {expense.diesel > 0 ? rupees(expense.diesel) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {expense.snacksFood > 0 ? rupees(expense.snacksFood) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {expense.serviceRepairs && expense.serviceRepairs > 0 ? (
                      <div>
                        <span>{rupees(expense.serviceRepairs)}</span>
                        {expense.serviceNotes && (
                          <div className="ml-auto max-w-[140px] truncate text-[11px] text-muted-foreground">
                            {expense.serviceNotes}
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {rupees(expense.diesel + expense.snacksFood + (expense.serviceRepairs || 0))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeleteCandidate(expense.id);
                        setDeleteConfirmation("");
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {visibleExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No expenses recorded yet
                  </td>
                </tr>
              )}
            </tbody>
            {visibleExpenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(totals.diesel)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(totals.snacksFood)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(totals.serviceRepairs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupees(totals.grandTotal)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {selectionMode === "week" ? "Weekly water filling charges" : "Daily water filling charges"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record up to three regular batches and one TVS batch. Batch charges are tracked
              separately from other expenses.
            </p>
          </div>
        </div>

        {selectionMode === "day" && showFillingForm ? (
          <>
            <div className="mt-5 space-y-3">
              {batchInputs.map((batch, index) => (
                <div
                  key={index}
                  className="grid items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)]"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`filling-batch-${index + 1}-cans`}>
                      {index === 3 ? "TVS batch" : `Batch ${index + 1}`} — cans filled
                    </Label>
                    <Input
                      id={`filling-batch-${index + 1}-cans`}
                      inputMode="numeric"
                      className="h-11"
                      placeholder="0"
                      value={batch.cans}
                      onChange={(event) => updateBatch(index, "cans", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`filling-batch-${index + 1}-rate`}>Rate per can (₹)</Label>
                    <Input
                      id={`filling-batch-${index + 1}-rate`}
                      inputMode="numeric"
                      className="h-11"
                      placeholder="12"
                      value={batch.rate}
                      onChange={(event) => updateBatch(index, "rate", event.target.value)}
                    />
                  </div>
                  <div className="flex h-11 items-center justify-between rounded-md bg-muted/40 px-3">
                    <span className="text-sm text-muted-foreground">
                      {index === 3 ? "TVS batch" : `Batch ${index + 1}`} bill
                    </span>
                    <span className="font-semibold tabular-nums text-destructive">
                      {rupees(batchBills[index] ?? 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Current water filling pending for this day
                </p>
                <p className="text-xl font-bold tabular-nums text-destructive">
                  {rupees(dailyFillingTotal)}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedFilling && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-5"
                    onClick={cancelWaterFillingEdit}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="button" className="h-11 px-6" onClick={saveWaterFilling}>
                  {selectedFilling ? "Update filling charges" : "Save filling charges"}
                </Button>
              </div>
            </div>
          </>
        ) : selectionMode === "day" && selectedFilling ? (
          <>
            <div className="mt-5 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 text-right font-medium">Cans filled</th>
                    <th className="px-4 py-3 text-right font-medium">Rate per can</th>
                    <th className="px-4 py-3 text-right font-medium">Batch bill</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFilling.batches.map((batch, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {index === 3 ? "TVS batch" : `Batch ${index + 1}`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{batch.cans}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupees(batch.rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-destructive">
                        {rupees(batch.cans * batch.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td colSpan={3} className="px-4 py-3">Daily water filling total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">
                      {rupees(
                        selectedFilling.batches.reduce(
                          (sum, batch) => sum + batch.cans * batch.rate,
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" className="h-10" onClick={editWaterFilling}>
                Edit
              </Button>
            </div>
          </>
        ) : selectionMode === "week" ? (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Batch 1</th>
                    <th className="px-4 py-3 text-right font-medium">Batch 2</th>
                    <th className="px-4 py-3 text-right font-medium">Batch 3</th>
                    <th className="px-4 py-3 text-right font-medium">TVS batch</th>
                    <th className="px-4 py-3 text-right font-medium">Daily total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFillingRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      {Array.from({ length: FILLING_BATCH_COUNT }, (_, index) => {
                        const batch = record.batches[index];
                        return (
                          <td key={index} className="px-4 py-3 text-right tabular-nums">
                            {batch && batch.cans > 0
                              ? rupees(batch.cans * batch.rate)
                              : "—"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-destructive">
                        {rupees(
                          record.batches.reduce(
                            (sum, batch) => sum + batch.cans * batch.rate,
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  ))}
                  {visibleFillingRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No water filling charges recorded for this week
                      </td>
                    </tr>
                  )}
                </tbody>
                {visibleFillingRecords.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td colSpan={5} className="px-4 py-3">Weekly water filling total</td>
                      <td className="px-4 py-3 text-right tabular-nums text-destructive">
                        {rupees(
                          visibleFillingRecords.reduce(
                            (sum, record) =>
                              sum +
                              record.batches.reduce(
                                (batchSum, batch) => batchSum + batch.cans * batch.rate,
                                0,
                              ),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        ) : null}
      </section>

      <Dialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
            setDeleteConfirmation("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm expense deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this expense. Type lowercase <strong>yes</strong> to
            confirm.
          </p>
          <Input
            autoComplete="off"
            aria-label='Type "yes" to confirm'
            placeholder="yes"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteExpense}>
              Delete expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PageNav current="/expenses" />
    </div>
  );
}