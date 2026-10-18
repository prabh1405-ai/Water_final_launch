import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportLedgerExcel } from "@/lib/export";
import { todayISO, useData } from "@/lib/store";
import { cn } from "@/lib/utils";

const ALL = "all";

export function ExportExcel({
  defaultCompanyId,
  followCompanyId,
  className,
  hideCompanySelect = false,
}: {
  defaultCompanyId?: string | null;
  followCompanyId?: string | null;
  className?: string;
  hideCompanySelect?: boolean;
}) {
  const data = useData();
  const [selectedCompany, setSelectedCompany] = useState<string>(defaultCompanyId ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedCompany(defaultCompanyId ?? "");
  }, [defaultCompanyId]);

  const value = followCompanyId || selectedCompany;
  const currentTarget = data.customers.find((c) => c.id === value);

  function handleCompanyChange(newVal: string) {
    setSelectedCompany(newVal);
  }

  async function run() {
    if (!value) {
      toast.error("Please choose a company to export");
      return;
    }
    setBusy(true);
    try {
      const companyToExport = value === ALL ? null : value;
      await exportLedgerExcel(data, companyToExport, todayISO());
      toast.success(
        companyToExport === null
          ? "Exported every company — one sheet each"
          : `Exported ${currentTarget?.name ?? "company"} ledger`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Could not create the Excel file");
    } finally {
      setBusy(false);
    }
  }

  if (hideCompanySelect) {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn("h-11 gap-2", className)}
        disabled={busy}
        onClick={run}
      >
        <Download className="size-4" />
        {busy ? "Preparing..." : "Export Excel"}
      </Button>
    );
  }

  return (
    <div className={cn("rounded-md border border-border bg-muted/40 p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="x-company">Export company</Label>
          <Select
            value={value}
            onValueChange={handleCompanyChange}
            disabled={Boolean(followCompanyId)}
          >
            <SelectTrigger id="x-company" className="h-11 w-full">
              <SelectValue placeholder="Choose company to export..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All companies</SelectItem>
              {data.customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:w-auto gap-2"
          disabled={busy}
          onClick={run}
        >
          <Download className="size-4" />
          {busy ? "Preparing..." : "Export Excel"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Includes every entry from the beginning up to today, with running pending totals.
      </p>
    </div>
  );
}
