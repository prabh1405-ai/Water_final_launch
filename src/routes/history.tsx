import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
import { ExportExcel } from "@/components/ExportExcel";
import { PageNav } from "@/components/PageNav";
import { rupees, shortDate, sortTxns, useData, useHydratedToday } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Water Can Accounts" },
      { name: "description", content: "Day, week, month or custom range transaction history." },
      { property: "og:title", content: "History — Water Can Accounts" },
      { property: "og:description", content: "Day, week, month or custom range transaction history." },
    ],
  }),
  component: HistoryPage,
});

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOfWeek(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return addDays(iso, -((date.getDay() + 6) % 7));
}

function formatWeekRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return `${startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function HistoryPage() {
  const data = useData();
  const hydratedToday = useHydratedToday();
  const [company, setCompany] = useState<string>("all");
  const [selectionMode, setSelectionMode] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (hydratedToday) setSelectedDate((prev) => prev || hydratedToday);
  }, [hydratedToday]);

  const currentWeekStart = hydratedToday ? mondayOfWeek(hydratedToday) : "";
  const visibleWeekStart = currentWeekStart ? addDays(currentWeekStart, weekOffset * 7) : "";
  const visibleWeekEnd = visibleWeekStart ? addDays(visibleWeekStart, 6) : "";
  const weekDates = visibleWeekStart
    ? Array.from({ length: 7 }, (_, index) => addDays(visibleWeekStart, index))
    : [];

  const range = useMemo(() => {
    if (selectionMode === "week") return { start: visibleWeekStart, end: visibleWeekEnd };
    return { start: selectedDate, end: selectedDate };
  }, [selectionMode, visibleWeekStart, visibleWeekEnd, selectedDate]);

  const rows = useMemo(() => {
    let list = data.txns;
    if (company !== "all") {
      list = list.filter((t) => t.customerId === company);
    }
    list = list.filter((t) => t.date >= range.start && t.date <= range.end);
    return sortTxns(list)
      .reverse()
      .map((t) => ({
        t,
        name: data.customers.find((c) => c.id === t.customerId)?.name ?? "—",
      }));
  }, [data, range, company]);

  const totals = rows.reduce(
    (acc, { t }) => ({
      cans: acc.cans + (t.cans ?? 0),
      delivery: acc.delivery + (t.type === "delivery" ? t.amount : 0),
      payment: acc.payment + (t.type === "payment" ? t.amount : 0),
    }),
    { cans: 0, delivery: 0, payment: 0 },
  );

  function selectDate(value: string) {
    if (!value) return;
    setSelectedDate(value);
    setSelectionMode("day");
    const weekDifference =
      (new Date(`${mondayOfWeek(value)}T00:00:00`).getTime() -
        new Date(`${currentWeekStart}T00:00:00`).getTime()) /
      (7 * 86400000);
    setWeekOffset(weekDifference);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <ExportExcel
          defaultCompanyId={company === "all" ? null : company}
          hideCompanySelect
        />
      </div>

      <div className="mt-5 max-w-sm space-y-1">
        <Label htmlFor="h-company" className="text-xs">
          Company
        </Label>
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger id="h-company" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {data.customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card p-4 sm:p-5">
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
                ? formatWeekRange(visibleWeekStart, visibleWeekEnd)
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
            const active = selectionMode === "day" && weekDate === selectedDate;
            const parsedDate = new Date(`${weekDate}T00:00:00`);
            return (
              <button
                key={weekDate}
                type="button"
                aria-pressed={active}
                aria-label={`Show ${parsedDate.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
                onClick={() => selectDate(weekDate)}
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
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label htmlFor="history-date" className="text-xs text-muted-foreground">
            Choose date
          </Label>
          <Input
            id="history-date"
            type="date"
            className="h-9 w-[170px]"
            value={selectedDate}
            onChange={(event) => selectDate(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Select a day for that day’s transactions, or select the week range for weekly history.
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {selectionMode === "week"
          ? `Showing ${shortDate(range.start)} to ${shortDate(range.end)}`
          : `Showing transactions for ${shortDate(range.start)}`}
        {company !== "all"
          ? ` for ${data.customers.find((c) => c.id === company)?.name ?? "selected company"}`
          : " for all companies"}
      </p>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 text-right font-medium">Cans</th>
              <th className="px-4 py-3 text-right font-medium">Rate</th>
              <th className="px-4 py-3 text-right font-medium">Delivery</th>
              <th className="px-4 py-3 text-right font-medium">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, name }) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{shortDate(t.date)}</td>
                <td className="px-4 py-3">{name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.cans ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.rate ? `₹${t.rate}` : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.type === "delivery" ? rupees(t.amount) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.type === "payment" ? rupees(t.amount) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No transactions in this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Total cans", String(totals.cans)],
          ["Total delivery amount", rupees(totals.delivery)],
          ["Total payments", rupees(totals.payment)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <PageNav current="/history" />
    </div>
  );
}
